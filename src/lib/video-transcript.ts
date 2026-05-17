import { YoutubeTranscript } from "youtube-transcript";
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

export async function getStructuredVideoContext(
  videoId: string,
): Promise<StructuredVideoContext> {
  try {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId);
      const lines: TranscriptLine[] = raw
        .map((t) => ({
          text: (t.text ?? "").trim(),
          offset: normalizeOffsetSeconds(t.offset ?? 0),
        }))
        .filter((line) => line.text.length > 0);

      if (lines.length > 0) {
        const joined = lines.map((l) => l.text).join(" ").trim();
        if (joined.length >= 10) {
          return { mode: "transcript", lines, joined };
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        !msg.includes("Transcript is disabled") &&
        !msg.includes("transcript")
      ) {
        throw e;
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
