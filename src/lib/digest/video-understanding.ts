import { GoogleGenAI, MediaResolution } from "@google/genai";
import { classifyGeminiError, type GeminiFailureKind } from "../gemini";
import { buildDigestSinglePassPrompt } from "./prompts";

/**
 * Gemini 네이티브 유튜브 영상 이해로 디제스트 생성.
 *
 * 배경: YouTube가 PO 토큰으로 서버측 자막 수집을 차단(2025~)했고,
 * 피드의 장편 라이브 녹화들은 자막 자체가 없는 경우가 많다.
 * Gemini는 공개 YouTube URL을 fileData로 직접 받아 음성·화면을 분석하므로
 * 자막 유무와 무관하게 동작하며 타임스탬프도 영상에서 직접 추출한다.
 *
 * 비용: MEDIA_RESOLUTION_LOW 기준 약 100토큰/초 (1시간 ≈ 36만 토큰).
 * 개인용 딥다이브 빈도에서는 허용 범위 — 결과는 캐시되어 영상당 1회만 발생.
 */

/** 이 길이(초)를 넘는 영상은 비용 보호를 위해 영상 이해를 건너뛴다 (≈3시간) */
export const VIDEO_UNDERSTANDING_MAX_SECONDS = 3 * 60 * 60;

const VIDEO_MODEL_ID = () =>
  process.env.GEMINI_MODEL_ID?.trim() || "models/gemini-2.5-flash";

export type VideoUnderstandingResult =
  | { ok: true; text: string }
  | { ok: false; kind: GeminiFailureKind };

/** fileUri에 unescaped 삽입되므로 lib 차원에서도 형식을 강제 (방어 심층화) */
const VIDEO_ID_PATTERN = /^[\w-]{5,20}$/;

export async function generateDigestTextFromVideoUrl(args: {
  videoId: string;
  title?: string;
  channel?: string | null;
  durationSeconds?: number | null;
}): Promise<VideoUnderstandingResult> {
  if (!VIDEO_ID_PATTERN.test(args.videoId)) {
    console.error("[DigestVideo] invalid videoId rejected:", args.videoId.slice(0, 30));
    return { ok: false, kind: "unavailable" };
  }
  if (!process.env.GEMINI_API_KEY) return { ok: false, kind: "missing_key" };

  const durationHint =
    args.durationSeconds && args.durationSeconds > 0
      ? ` 이 영상의 길이는 약 ${Math.floor(args.durationSeconds / 60)}분이며, 모든 timestamp는 이 길이를 넘을 수 없습니다.`
      : "";
  const prompt = buildDigestSinglePassPrompt({
    title: args.title,
    channel: args.channel,
    mode: "transcript", // 영상에서 타임스탬프를 직접 추출하므로 타임스탬프 규칙 활성화
    text: `(자막 텍스트 대신 첨부된 유튜브 영상을 직접 분석하세요. timestamp는 영상의 실제 시각을 MM:SS 또는 H:MM:SS로 적습니다.${durationHint})`,
  });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await ai.models.generateContent({
      model: VIDEO_MODEL_ID(),
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: `https://www.youtube.com/watch?v=${args.videoId}` } },
            { text: prompt },
          ],
        },
      ],
      config: {
        // 영상 토큰 비용 절감 — 디제스트는 음성·자막 내용이 핵심이라 저해상도로 충분
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      },
    });
    const text = res.text || null;
    return text ? { ok: true, text } : { ok: false, kind: "unavailable" };
  } catch (e: unknown) {
    const kind = classifyGeminiError(e);
    console.error(`[DigestVideo] Gemini video understanding failed (${kind})`, e);
    return { ok: false, kind };
  }
}
