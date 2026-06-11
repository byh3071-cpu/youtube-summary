"use server";

import { cookies } from "next/headers";
import { geminiFailureMessage } from "@/lib/gemini";
import { checkUsageLimit, incrementUsage } from "@/lib/plan";
import { guardGeminiActionRateLimit } from "@/lib/gemini-rate-limit";
import { generateVideoDigest } from "@/lib/digest/generate";
import {
  getCachedDigest,
  getStructuredVideoContextCached,
  saveDigest,
} from "@/lib/digest/store";
import type { VideoDigest } from "@/lib/digest/types";
import type { TranscriptLine } from "@/lib/video-transcript";

export type DigestActionResult =
  | {
      ok: true;
      digest: VideoDigest;
      cached: boolean;
      degraded: boolean;
      sourceMode: "transcript" | "snippet" | "video";
      chunkCount: number;
    }
  | { ok: false; error: string };

const VIDEO_ID_PATTERN = /^[\w-]{5,20}$/;

/** 캐시에 기록할 기본 모델 ID — gemini.ts의 기본값과 동일하게 유지 */
function currentModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || "models/gemini-2.5-flash";
}

/**
 * 영상 디제스트 생성/조회.
 * - 캐시 히트면 Gemini 0콜로 즉시 반환 (사용량 미차감)
 * - force=true면 디제스트 캐시만 무시하고 재생성 (트랜스크립트 캐시는 재사용)
 */
export async function generateVideoDigestAction(args: {
  videoId: string;
  title?: string;
  channel?: string | null;
  durationSeconds?: number | null;
  force?: boolean;
}): Promise<DigestActionResult> {
  const { videoId, title, channel, durationSeconds, force } = args;
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    return { ok: false, error: "올바르지 않은 영상 ID입니다." };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: geminiFailureMessage("missing_key") };
  }

  const burst = await guardGeminiActionRateLimit("insight");
  if (!burst.ok) {
    return { ok: false, error: burst.error };
  }

  const cookieStore = await cookies();
  const limitResult = await checkUsageLimit(cookieStore, "insight");
  if (!limitResult.allowed) {
    return { ok: false, error: limitResult.error };
  }

  if (!force) {
    const cached = await getCachedDigest(videoId);
    if (cached) {
      return {
        ok: true,
        digest: cached.digest,
        cached: true,
        degraded: cached.degraded,
        sourceMode: cached.sourceMode,
        chunkCount: cached.chunkCount,
      };
    }
  }

  const context = await getStructuredVideoContextCached(videoId);
  if ("error" in context) {
    return { ok: false, error: context.error };
  }

  const result = await generateVideoDigest({ videoId, title, channel, durationSeconds, context });
  if (!result.ok) {
    return { ok: false, error: result.message };
  }

  await saveDigest({
    videoId,
    digest: result.digest,
    model: currentModelId(),
    sourceMode: result.sourceMode,
    chunkCount: result.chunkCount,
    degraded: result.degraded,
    failedChunks: result.failedChunks,
  });
  await incrementUsage(cookieStore, "insight");

  return {
    ok: true,
    digest: result.digest,
    cached: false,
    degraded: result.degraded,
    sourceMode: result.sourceMode,
    chunkCount: result.chunkCount,
  };
}

export type TranscriptActionResult =
  | { ok: true; mode: "transcript"; lines: TranscriptLine[] }
  | { ok: true; mode: "snippet"; text: string }
  | { ok: false; error: string };

/**
 * 자막 전문 조회 (디제스트 드로어의 "자막 전문" 토글용).
 * Gemini 호출 없음 — 캐시 우선, miss 시 youtube-transcript 1회.
 */
export async function getVideoTranscriptAction(videoId: string): Promise<TranscriptActionResult> {
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    return { ok: false, error: "올바르지 않은 영상 ID입니다." };
  }
  const context = await getStructuredVideoContextCached(videoId);
  if ("error" in context) {
    return { ok: false, error: context.error };
  }
  if (context.mode === "transcript") {
    return { ok: true, mode: "transcript", lines: context.lines };
  }
  return { ok: true, mode: "snippet", text: context.text };
}
