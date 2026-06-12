import { NextResponse } from "next/server";
import { generateVideoDigest } from "@/lib/digest/generate";
import {
  getCachedDigest,
  getStructuredVideoContextCached,
  saveDigest,
} from "@/lib/digest/store";
import { fetchVideoDetails } from "@/lib/youtube";

export const dynamic = "force-dynamic";
/** 긴 영상은 맵-리듀스로 수 분이 걸릴 수 있음 */
export const maxDuration = 300;

/**
 * 디제스트 파이프라인 디버그/검증 엔드포인트.
 * 실제 사용자 경로(generateVideoDigestAction)의 레이트리밋·사용량 게이트를 건너뛰고
 * lib 파이프라인을 직접 호출한다 — 운영 검증 전용.
 * debug-youtube와 동일한 게이팅: 프로덕션 기본 404, ENABLE_DEBUG_DIGEST=true일 때만 허용.
 *
 * GET /api/debug-digest?videoId=...&force=1
 */
export async function GET(request: Request) {
  const allowProd =
    process.env.ENABLE_DEBUG_DIGEST === "true" || process.env.ENABLE_DEBUG_DIGEST === "1";
  if (process.env.NODE_ENV === "production" && !allowProd) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");
  if (!videoId || !/^[\w-]{5,20}$/.test(videoId)) {
    return NextResponse.json({ error: "videoId query required" }, { status: 400 });
  }
  const force = searchParams.get("force") === "1";

  const startedAt = Date.now();

  if (!force) {
    const cached = await getCachedDigest(videoId);
    if (cached) {
      return NextResponse.json({
        elapsedMs: Date.now() - startedAt,
        ok: true,
        cached: true,
        ...cached,
      });
    }
  }

  const context = await getStructuredVideoContextCached(videoId);
  if ("error" in context) {
    return NextResponse.json({ elapsedMs: Date.now() - startedAt, ok: false, error: context.error });
  }

  // 실제 action(runGeneration)과 동일하게 서버에서 duration을 재조회해
  // 환각 가드(maxSeconds)가 동일하게 적용되도록 한다. ?duration은 폴백.
  const durationParam = Number(searchParams.get("duration"));
  let durationSeconds: number | null =
    Number.isFinite(durationParam) && durationParam > 0 ? durationParam : null;
  try {
    const details = await fetchVideoDetails([videoId]);
    const serverDuration = details.durationSeconds[videoId];
    if (typeof serverDuration === "number" && serverDuration > 0) durationSeconds = serverDuration;
  } catch {
    /* 폴백: 쿼리 값 또는 null */
  }
  const result = await generateVideoDigest({ videoId, durationSeconds, context });
  if (!result.ok) {
    return NextResponse.json({ elapsedMs: Date.now() - startedAt, ok: false, error: result.message });
  }

  await saveDigest({
    videoId,
    digest: result.digest,
    model: process.env.GEMINI_MODEL_ID?.trim() || "models/gemini-2.5-flash",
    sourceMode: result.sourceMode,
    chunkCount: result.chunkCount,
    degraded: result.degraded,
    failedChunks: result.failedChunks,
  });

  return NextResponse.json({ elapsedMs: Date.now() - startedAt, cached: false, ...result });
}
