import {
  generateGeminiTextResult,
  geminiFailureMessage,
  type GeminiFailureKind,
  type GeminiTextResult,
} from "../gemini";
import type { StructuredVideoContext } from "../video-transcript";
import { chunkTranscript, renderLines } from "./chunking";
import {
  buildDigestMapPrompt,
  buildDigestReducePrompt,
  buildDigestSinglePassPrompt,
  PURE_JSON_RETRY_HINT,
} from "./prompts";
import { safeParseChunkDigest, safeParseVideoDigest } from "./parse";
import {
  generateDigestTextFromVideoUrl,
  VIDEO_UNDERSTANDING_MAX_SECONDS,
} from "./video-understanding";
import type { VideoDigest } from "./types";

const MAP_RETRY_DELAY_MS = 1_500;
const CALL_TIMEOUT_MS = 60_000;

export type DigestSourceMode = "transcript" | "snippet" | "video";

export type DigestGenResult =
  | {
      ok: true;
      digest: VideoDigest;
      sourceMode: DigestSourceMode;
      chunkCount: number;
      degraded: boolean;
      failedChunks: number;
    }
  | { ok: false; message: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gemini 호출에 로컬 타임아웃을 씌운다 (gemini.ts는 병렬 작업 소유라 무수정). */
async function callGemini(prompt: string, label: string): Promise<GeminiTextResult> {
  const timeout = new Promise<GeminiTextResult>((resolve) =>
    setTimeout(() => resolve({ ok: false, kind: "unavailable" }), CALL_TIMEOUT_MS),
  );
  return Promise.race([generateGeminiTextResult(prompt, label), timeout]);
}

function isFatalKind(kind: GeminiFailureKind): boolean {
  return kind === "auth" || kind === "missing_key";
}

async function runSinglePass(args: {
  title?: string;
  channel?: string | null;
  mode: "transcript" | "snippet";
  text: string;
}): Promise<DigestGenResult> {
  const prompt = buildDigestSinglePassPrompt(args);
  let res = await callGemini(prompt, "Digest");
  if (!res.ok && !isFatalKind(res.kind)) {
    await sleep(MAP_RETRY_DELAY_MS);
    res = await callGemini(prompt, "Digest");
  }
  if (!res.ok) return { ok: false, message: geminiFailureMessage(res.kind) };

  let digest = safeParseVideoDigest(res.text, { hasTimestamps: args.mode === "transcript" });
  if (!digest) {
    const retry = await callGemini(prompt + PURE_JSON_RETRY_HINT, "Digest");
    if (retry.ok) {
      digest = safeParseVideoDigest(retry.text, { hasTimestamps: args.mode === "transcript" });
    }
  }
  if (!digest) {
    return { ok: false, message: "AI 응답을 해석하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return {
    ok: true,
    digest,
    sourceMode: args.mode,
    chunkCount: 1,
    degraded: false,
    failedChunks: 0,
  };
}

/**
 * 디제스트 생성 오케스트레이터 (쿠키·사용량·캐시 무관한 순수 파이프라인).
 * - 짧은 영상/스니펫: 단일 패스 (1콜)
 * - 긴 영상: 청크 맵(순차, RPM 보호) → 리듀스
 * - 실패 청크는 1회 재시도 후 스킵, 1/3 초과 실패 시 중단
 */
export async function generateVideoDigest(args: {
  videoId?: string;
  title?: string;
  channel?: string | null;
  durationSeconds?: number | null;
  context: StructuredVideoContext;
}): Promise<DigestGenResult> {
  const { videoId, title, channel, durationSeconds, context } = args;
  if ("error" in context) {
    return { ok: false, message: context.error };
  }

  if (context.mode === "snippet") {
    // 자막이 없는 영상: Gemini 네이티브 영상 이해를 먼저 시도
    // (YouTube의 PO 토큰 차단 + 라이브 녹화의 자막 부재 모두 우회, 타임스탬프도 영상에서 추출)
    const withinCostGuard =
      durationSeconds == null || durationSeconds <= VIDEO_UNDERSTANDING_MAX_SECONDS;
    if (videoId && withinCostGuard) {
      const vres = await generateDigestTextFromVideoUrl({
        videoId,
        title,
        channel,
        durationSeconds,
      });
      if (vres.ok) {
        const digest = safeParseVideoDigest(vres.text, {
          hasTimestamps: true,
          maxSeconds: durationSeconds ?? undefined,
        });
        if (digest) {
          return {
            ok: true,
            digest,
            sourceMode: "video",
            chunkCount: 1,
            degraded: false,
            failedChunks: 0,
          };
        }
      } else if (isFatalKind(vres.kind)) {
        return { ok: false, message: geminiFailureMessage(vres.kind) };
      }
      // 영상 이해 실패(비공개·연령제한·일시 장애 등) 시 제목·설명 폴백으로 진행
    }
    return runSinglePass({ title, channel, mode: "snippet", text: context.text });
  }

  const chunks = chunkTranscript(context.lines);
  if (chunks.length === 0) {
    return { ok: false, message: "분석할 자막 내용이 없습니다." };
  }
  if (chunks.length === 1) {
    return runSinglePass({
      title,
      channel,
      mode: "transcript",
      text: renderLines(context.lines),
    });
  }

  // 맵 단계 — 순차 실행 (병렬은 Gemini RPM·버스트 리밋과 충돌)
  const parts: string[] = [];
  let failedChunks = 0;
  for (const chunk of chunks) {
    const prompt = buildDigestMapPrompt({ title, channel, chunk, chunkTotal: chunks.length });
    let res = await callGemini(prompt, "DigestMap");
    if (!res.ok) {
      if (isFatalKind(res.kind)) {
        return { ok: false, message: geminiFailureMessage(res.kind) };
      }
      await sleep(MAP_RETRY_DELAY_MS);
      res = await callGemini(prompt, "DigestMap");
    }
    if (!res.ok) {
      if (isFatalKind(res.kind)) {
        return { ok: false, message: geminiFailureMessage(res.kind) };
      }
      failedChunks += 1;
      continue;
    }
    const parsed = safeParseChunkDigest(res.text);
    if (!parsed) {
      failedChunks += 1;
      continue;
    }
    parts.push(JSON.stringify(parsed));
  }

  if (parts.length === 0 || failedChunks > Math.floor(chunks.length / 3)) {
    return {
      ok: false,
      message: "영상 구간 분석이 과반 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  // 리듀스 단계
  const reducePrompt = buildDigestReducePrompt({ title, channel, parts });
  let reduceRes = await callGemini(reducePrompt, "DigestReduce");
  let digest = reduceRes.ok ? safeParseVideoDigest(reduceRes.text, { hasTimestamps: true }) : null;
  if (!digest) {
    if (reduceRes.ok === false && isFatalKind(reduceRes.kind)) {
      return { ok: false, message: geminiFailureMessage(reduceRes.kind) };
    }
    reduceRes = await callGemini(reducePrompt + PURE_JSON_RETRY_HINT, "DigestReduce");
    digest = reduceRes.ok ? safeParseVideoDigest(reduceRes.text, { hasTimestamps: true }) : null;
  }
  if (!digest) {
    return {
      ok: false,
      message: "분석 결과 통합에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  return {
    ok: true,
    digest,
    sourceMode: "transcript",
    chunkCount: chunks.length,
    degraded: failedChunks > 0,
    failedChunks,
  };
}
