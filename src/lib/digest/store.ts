import { getMutationTable } from "../supabase-server";
import {
  getStructuredVideoContext,
  type StructuredVideoContext,
  type TranscriptLine,
} from "../video-transcript";
import { DIGEST_SCHEMA_VERSION, type VideoDigest } from "./types";

/**
 * video_transcripts / video_digests 캐시 CRUD.
 * 신규 테이블이라 Database 타입에 없으므로 getMutationTable(무타입)을 사용한다
 * (supabase-server.ts 무수정 — 병렬 작업 충돌 방지). 모든 실패는 캐시 미스로 강등.
 */

function isValidLine(v: unknown): v is TranscriptLine {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as TranscriptLine).text === "string" &&
    typeof (v as TranscriptLine).offset === "number"
  );
}

export async function getCachedTranscript(
  videoId: string,
): Promise<StructuredVideoContext | null> {
  const table = getMutationTable("video_transcripts");
  if (!table) return null;
  try {
    const { data, error } = await table
      .select("mode, lines, text")
      .eq("video_id", videoId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.mode === "transcript" && Array.isArray(data.lines)) {
      const lines = (data.lines as unknown[]).filter(isValidLine);
      const joined = lines.map((l) => l.text).join(" ").trim();
      if (lines.length > 0 && joined.length >= 10) {
        return { mode: "transcript", lines, joined };
      }
    }
    if (data.mode === "snippet" && typeof data.text === "string" && data.text.length >= 10) {
      return { mode: "snippet", text: data.text };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveTranscript(
  videoId: string,
  ctx: Exclude<StructuredVideoContext, { error: string }>,
): Promise<void> {
  const table = getMutationTable("video_transcripts");
  if (!table) return;
  const row =
    ctx.mode === "transcript"
      ? {
          video_id: videoId,
          mode: "transcript",
          lines: ctx.lines,
          text: null,
          char_count: ctx.joined.length,
        }
      : {
          video_id: videoId,
          mode: "snippet",
          lines: null,
          text: ctx.text,
          char_count: ctx.text.length,
        };
  try {
    // supabase-js는 실패 시 throw하지 않고 { error }를 반환한다
    const { error } = await table.upsert(row, { onConflict: "video_id" });
    if (error) console.error("[DigestStore] saveTranscript failed", error.message ?? error);
  } catch (e) {
    console.error("[DigestStore] saveTranscript failed", e);
  }
}

/** 캐시 우선 트랜스크립트 조회 — miss면 기존 파이프라인으로 가져와 저장. */
export async function getStructuredVideoContextCached(
  videoId: string,
): Promise<StructuredVideoContext> {
  const cached = await getCachedTranscript(videoId);
  if (cached) return cached;
  const fresh = await getStructuredVideoContext(videoId);
  if (!("error" in fresh)) {
    await saveTranscript(videoId, fresh);
  }
  return fresh;
}

export interface CachedDigest {
  digest: VideoDigest;
  sourceMode: "transcript" | "snippet" | "video";
  chunkCount: number;
  degraded: boolean;
}

export async function getCachedDigest(videoId: string): Promise<CachedDigest | null> {
  const table = getMutationTable("video_digests");
  if (!table) return null;
  try {
    const { data, error } = await table
      .select("digest, source_mode, chunk_count, degraded")
      .eq("video_id", videoId)
      .eq("schema_version", DIGEST_SCHEMA_VERSION)
      .maybeSingle();
    if (error || !data?.digest) return null;
    const digest = data.digest as VideoDigest;
    if (typeof digest.headline !== "string" || typeof digest.summary !== "string") return null;
    const sourceMode =
      data.source_mode === "snippet" || data.source_mode === "video"
        ? data.source_mode
        : "transcript";
    return {
      digest,
      sourceMode,
      chunkCount: typeof data.chunk_count === "number" ? data.chunk_count : 1,
      degraded: data.degraded === true,
    };
  } catch {
    return null;
  }
}

export async function saveDigest(args: {
  videoId: string;
  digest: VideoDigest;
  model: string;
  sourceMode: "transcript" | "snippet" | "video";
  chunkCount: number;
  degraded: boolean;
  failedChunks: number;
}): Promise<void> {
  const table = getMutationTable("video_digests");
  if (!table) return;
  try {
    const { error } = await table.upsert(
      {
        video_id: args.videoId,
        schema_version: DIGEST_SCHEMA_VERSION,
        digest: args.digest,
        model: args.model,
        source_mode: args.sourceMode,
        chunk_count: args.chunkCount,
        degraded: args.degraded,
        failed_chunks: args.failedChunks,
      },
      { onConflict: "video_id,schema_version" },
    );
    if (error) console.error("[DigestStore] saveDigest failed", error.message ?? error);
  } catch (e) {
    console.error("[DigestStore] saveDigest failed", e);
  }
}
