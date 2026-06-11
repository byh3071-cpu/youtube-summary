import { GoogleGenAI } from "@google/genai";

/**
 * Gemini 텍스트 생성 공통 헬퍼.
 * - 모델은 `GEMINI_MODEL_ID` 환경 변수로 교체 가능 (기본: 저렴한 Flash 계열)
 * - 기본 모델이 404(미지원/retire)면 `gemini-flash-latest`로 1회 폴백
 */

const FALLBACK_MODEL_ID = "models/gemini-flash-latest";
const DEFAULT_MODEL_ID = "models/gemini-2.5-flash";

function getGeminiModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
}

function isNotFound(e: unknown): boolean {
  const err = e as {
    error?: { code?: number | string };
    code?: number | string;
    status?: number | string;
  };
  const code = err?.error?.code ?? err?.code ?? err?.status;
  return code === 404 || code === "NOT_FOUND";
}

/**
 * 프롬프트를 보내고 텍스트를 받는다. 실패 시 null (호출부가 사용자 메시지 결정).
 * @param label 로그 식별용 태그 (예: "Summarize", "FeedQA")
 */
export async function generateGeminiText(
  prompt: string,
  label: string,
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const run = async (model: string) => {
    const res = await ai.models.generateContent({ model, contents: prompt });
    return res.text || null;
  };

  const primary = getGeminiModelId();
  try {
    return await run(primary);
  } catch (e: unknown) {
    if (isNotFound(e) && primary !== FALLBACK_MODEL_ID) {
      console.error(
        `[${label}] Gemini model "${primary}" unavailable (404). Falling back to "${FALLBACK_MODEL_ID}". GEMINI_MODEL_ID 환경 변수를 확인하세요.`,
      );
      try {
        return await run(FALLBACK_MODEL_ID);
      } catch (e2: unknown) {
        console.error(`[${label}] Gemini fallback model failed`, e2);
        return null;
      }
    }
    console.error(`[${label}] Gemini generateContent failed`, e);
    return null;
  }
}
