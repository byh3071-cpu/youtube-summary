import { fetchTranscriptLines } from "@/lib/video-transcript";
import { getVideoSnippet } from "@/lib/youtube";

export type VideoContextResult =
  | { text: string; source: "자막" | "제목·설명" }
  | { error: string };

/**
 * YouTube 영상의 텍스트 컨텍스트를 가져옵니다.
 * 1차: 자막(video-transcript.ts의 공유 페처 — legacy lib → InnerTube 폴백),
 * 2차: 제목·설명 폴백.
 */
export async function getVideoContext(
  videoId: string,
): Promise<VideoContextResult> {
  try {
    // 1. 자막 시도
    const lines = await fetchTranscriptLines(videoId);
    const transcriptText = lines.map((l) => l.text).join(" ").trim();
    if (transcriptText.length >= 10) {
      return { text: transcriptText, source: "자막" };
    }

    // 2. 자막이 없으면 제목·설명으로 폴백
    const fetched = await getVideoSnippet(videoId);
    if (fetched && (fetched.title || fetched.description)) {
      const snippetText = [fetched.title, fetched.description]
        .filter(Boolean)
        .join("\n\n")
        .trim()
        .slice(0, 8000);
      if (snippetText.length >= 10) {
        return { text: snippetText, source: "제목·설명" };
      }
    }

    return {
      error:
        "이 영상은 자막이 없고, 제목·설명으로도 요약하기 어렵습니다. 자막이 켜진 다른 영상을 선택해 주세요.",
    };
  } catch (error) {
    console.error("getVideoContext Error:", error);
    return {
      error:
        "영상 내용을 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
