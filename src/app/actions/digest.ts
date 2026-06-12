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
import { fetchVideoDetails } from "@/lib/youtube";

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

type GenerationOutcome =
  | {
      ok: true;
      digest: VideoDigest;
      sourceMode: "transcript" | "snippet" | "video";
      chunkCount: number;
      degraded: boolean;
      failedChunks: number;
      saved: boolean;
    }
  | { ok: false; error: string };

/**
 * 같은 영상의 동시 생성 요청 dedupe (서버 인스턴스 내).
 * 더블클릭·다중 탭이 같은 미캐시 영상을 열어도 Gemini 영상 이해는 1회만 호출된다.
 */
const inFlightGenerations = new Map<string, Promise<GenerationOutcome>>();

async function runGeneration(args: {
  videoId: string;
  title?: string;
  channel?: string | null;
  durationSeconds?: number | null;
}): Promise<GenerationOutcome> {
  const { videoId, title, channel } = args;

  // durationSeconds는 클라이언트 제공값 — 생략·조작 시 3시간 비용 가드와 타임스탬프
  // 환각 가드가 무력화되므로, 신뢰하지 않고 서버에서 YouTube API로 재조회한다.
  let durationSeconds =
    typeof args.durationSeconds === "number" &&
    Number.isFinite(args.durationSeconds) &&
    args.durationSeconds > 0
      ? args.durationSeconds
      : null;
  try {
    const details = await fetchVideoDetails([videoId]);
    const serverDuration = details.durationSeconds[videoId];
    if (typeof serverDuration === "number" && serverDuration > 0) {
      durationSeconds = serverDuration;
    }
  } catch {
    // 조회 실패 시 클라이언트 값(검증된 범위) 또는 null로 진행
  }

  const context = await getStructuredVideoContextCached(videoId);
  if ("error" in context) {
    return { ok: false, error: context.error };
  }
  const result = await generateVideoDigest({ videoId, title, channel, durationSeconds, context });
  if (!result.ok) {
    return { ok: false, error: result.message };
  }
  const saved = await saveDigest({
    videoId,
    digest: result.digest,
    model: currentModelId(),
    sourceMode: result.sourceMode,
    chunkCount: result.chunkCount,
    degraded: result.degraded,
    failedChunks: result.failedChunks,
  });
  return {
    ok: true,
    digest: result.digest,
    sourceMode: result.sourceMode,
    chunkCount: result.chunkCount,
    degraded: result.degraded,
    failedChunks: result.failedChunks,
    saved,
  };
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

  // 캐시 조회를 한도·레이트리밋 검사보다 먼저 한다 — 캐시 히트는 Gemini 0콜·사용량 미차감이므로
  // 한도를 소진한 사용자도 이미 생성된 디제스트는 그대로 다시 볼 수 있어야 한다.
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

  // 캐시 미스일 때만 생성 비용이 드므로, 여기서부터 키·레이트리밋·한도를 검사한다.
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

  // 동시 첫 요청 dedupe — 생성·저장은 영상당 1회만, 후속 동시 요청은 같은 결과를 공유
  let generation = inFlightGenerations.get(videoId);
  const isInitiator = !generation;
  if (!generation) {
    generation = runGeneration({ videoId, title, channel, durationSeconds }).finally(() => {
      inFlightGenerations.delete(videoId);
    });
    inFlightGenerations.set(videoId, generation);
  }
  const outcome = await generation;
  if (!outcome.ok) {
    return outcome;
  }

  // 캐시 저장 실패 시 사용량 미차감 — 다음 요청이 어차피 재생성(재과금)되므로 이중 청구 방지.
  // 동시 요청 중 최초 호출자만 차감 (생성은 1회였으므로).
  if (isInitiator && outcome.saved) {
    await incrementUsage(cookieStore, "insight");
  }

  return {
    ok: true,
    digest: outcome.digest,
    cached: false,
    degraded: outcome.degraded,
    sourceMode: outcome.sourceMode,
    chunkCount: outcome.chunkCount,
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
