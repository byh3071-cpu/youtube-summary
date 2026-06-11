import { YoutubeTranscript } from "youtube-transcript";
import { Innertube } from "youtubei.js";
import { getVideoSnippet } from "@/lib/youtube";

export interface TranscriptLine {
  text: string;
  offset: number;
}

export type StructuredVideoContext =
  | { mode: "transcript"; lines: TranscriptLine[]; joined: string }
  | { mode: "snippet"; text: string }
  | { error: string };

const OFFSET_DIVISOR_GUESS_THRESHOLD_MS = 1000 * 60 * 60 * 12;

function normalizeOffsetSeconds(rawOffset: number): number {
  if (!Number.isFinite(rawOffset) || rawOffset < 0) return 0;
  if (rawOffset > OFFSET_DIVISOR_GUESS_THRESHOLD_MS) return rawOffset / 1000;
  return rawOffset;
}

export function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** youtubei.js Innertube 인스턴스 싱글톤 (생성 비용이 있어 재사용) */
let innertubePromise: Promise<Innertube> | null = null;
function getInnertube(): Promise<Innertube> {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({ lang: "ko", retrieve_player: false });
  }
  return innertubePromise;
}

/** youtube-transcript 라이브러리 경로 (YouTube 변경으로 자주 깨짐 — 1차 시도용) */
async function fetchLinesViaLegacyLib(videoId: string): Promise<TranscriptLine[]> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId);
  return raw
    .map((t) => ({
      text: (t.text ?? "").trim(),
      offset: normalizeOffsetSeconds(t.offset ?? 0),
    }))
    .filter((line) => line.text.length > 0);
}

/** InnerTube(youtubei.js) 경로 — 공식 웹 클라이언트와 동일한 API라 견고함 */
async function fetchLinesViaInnertube(videoId: string): Promise<TranscriptLine[]> {
  const yt = await getInnertube();
  const info = await yt.getInfo(videoId);
  const transcriptData = await info.getTranscript();
  const segments = transcriptData?.transcript?.content?.body?.initial_segments ?? [];
  const lines: TranscriptLine[] = [];
  for (const seg of segments) {
    const text = (seg?.snippet?.text?.toString() ?? "").trim();
    if (!text) continue;
    const startMs = Number(seg?.start_ms ?? 0);
    lines.push({ text, offset: Number.isFinite(startMs) ? startMs / 1000 : 0 });
  }
  return lines;
}

/**
 * 자막 줄 가져오기 — legacy 라이브러리 → InnerTube 순서로 시도.
 * 둘 다 실패하면 빈 배열 (호출부가 snippet 폴백).
 * video-context.ts(요약·인사이트)와 공유한다.
 */
export async function fetchTranscriptLines(videoId: string): Promise<TranscriptLine[]> {
  try {
    const lines = await fetchLinesViaLegacyLib(videoId);
    if (lines.length > 0) return lines;
  } catch {
    // legacy 라이브러리는 YouTube 변경으로 상시 깨질 수 있음 — InnerTube로 폴백
  }
  try {
    return await fetchLinesViaInnertube(videoId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 자막이 정말 없는 영상이면 조용히, 그 외는 한 번 로그
    if (!/transcript/i.test(msg)) {
      console.error("[Transcript] Innertube fetch failed:", msg);
    }
    return [];
  }
}

export async function getStructuredVideoContext(
  videoId: string,
): Promise<StructuredVideoContext> {
  try {
    const lines = await fetchTranscriptLines(videoId);
    if (lines.length > 0) {
      const joined = lines.map((l) => l.text).join(" ").trim();
      if (joined.length >= 10) {
        return { mode: "transcript", lines, joined };
      }
    }

    const snippet = await getVideoSnippet(videoId);
    if (snippet && (snippet.title || snippet.description)) {
      const text = [snippet.title, snippet.description]
        .filter(Boolean)
        .join("\n\n")
        .trim()
        .slice(0, 8000);
      if (text.length >= 10) {
        return { mode: "snippet", text };
      }
    }

    return {
      error:
        "이 영상은 자막이 없고, 제목·설명으로도 정리하기 어렵습니다. 자막이 있는 영상을 선택해 주세요.",
    };
  } catch (error) {
    console.error("getStructuredVideoContext Error:", error);
    return {
      error:
        "영상 내용을 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
