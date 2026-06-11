import { GoogleGenAI } from "@google/genai";

/**
 * Gemini 텍스트 생성 공통 헬퍼.
 * - 모델은 `GEMINI_MODEL_ID` 환경 변수로 교체 가능 (기본: 저렴한 Flash 계열)
 * - 기본 모델이 404(미지원/retire)면 `gemini-flash-latest`로 1회 폴백
 * - 실패는 종류(kind)로 분류해 호출부가 "운영 설정 오류"와 "일시 장애"를 구분할 수 있게 한다.
 */

const FALLBACK_MODEL_ID = "models/gemini-flash-latest";
const DEFAULT_MODEL_ID = "models/gemini-2.5-flash";

function getGeminiModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
}

export type GeminiFailureKind =
  /** GEMINI_API_KEY 미설정 */
  | "missing_key"
  /** 키 만료·무효·권한 등 운영 설정 오류 — 재시도로 해결되지 않음 */
  | "auth"
  /** 쿼터/레이트 리밋 초과 */
  | "rate_limited"
  /** 그 외 일시 장애(네트워크, 5xx 등) */
  | "unavailable";

export type GeminiTextResult =
  | { ok: true; text: string }
  | { ok: false; kind: GeminiFailureKind };

/** 사용자에게 보여줄 공통 오류 문구. 비밀값·서버 에러 객체는 절대 포함하지 않는다. */
const GEMINI_FAILURE_MESSAGES: Record<GeminiFailureKind, string> = {
  missing_key: "AI 기능이 아직 설정되지 않았습니다. 운영자에게 GEMINI_API_KEY 설정을 요청해 주세요.",
  auth: "AI 연동 설정 오류입니다(키 만료/무효). 재시도로 해결되지 않으니 운영자가 Gemini API 키를 갱신해야 합니다.",
  rate_limited: "AI 요청이 일시적으로 많습니다. 잠시 후 다시 시도해 주세요.",
  unavailable: "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
};

export function geminiFailureMessage(kind: GeminiFailureKind): string {
  return GEMINI_FAILURE_MESSAGES[kind];
}

function readErrorParts(e: unknown): { code: number | string | undefined; text: string } {
  const err = e as {
    error?: { code?: number | string; status?: string; message?: string };
    code?: number | string;
    status?: number | string;
    message?: string;
  };
  const code = err?.error?.code ?? err?.code ?? err?.status;
  const text = [err?.error?.status, err?.error?.message, err?.message, typeof e === "string" ? e : ""]
    .filter(Boolean)
    .join(" ");
  return { code, text };
}

function isNotFound(e: unknown): boolean {
  const { code } = readErrorParts(e);
  return code === 404 || code === "NOT_FOUND";
}

/** Gemini 오류를 운영 설정 오류/레이트 리밋/일시 장애로 분류 */
export function classifyGeminiError(e: unknown): GeminiFailureKind {
  const { code, text } = readErrorParts(e);
  // 키 만료는 HTTP 400(INVALID_ARGUMENT) + "API key expired" 메시지로 내려온다.
  if (
    text.includes("API key expired") ||
    text.includes("API_KEY_INVALID") ||
    text.includes("API key not valid") ||
    text.includes("UNAUTHENTICATED") ||
    text.includes("PERMISSION_DENIED") ||
    code === 401 ||
    code === 403
  ) {
    return "auth";
  }
  if (code === 429 || text.includes("RESOURCE_EXHAUSTED")) {
    return "rate_limited";
  }
  return "unavailable";
}

/**
 * 프롬프트를 보내고 결과를 받는다. 실패 시 kind로 원인을 구분해 반환.
 * @param label 로그 식별용 태그 (예: "Summarize", "FeedQA")
 */
export async function generateGeminiTextResult(
  prompt: string,
  label: string,
): Promise<GeminiTextResult> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, kind: "missing_key" };

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const run = async (model: string) => {
    const res = await ai.models.generateContent({ model, contents: prompt });
    return res.text || null;
  };

  const primary = getGeminiModelId();
  try {
    const text = await run(primary);
    return text ? { ok: true, text } : { ok: false, kind: "unavailable" };
  } catch (e: unknown) {
    if (isNotFound(e) && primary !== FALLBACK_MODEL_ID) {
      console.error(
        `[${label}] Gemini model "${primary}" unavailable (404). Falling back to "${FALLBACK_MODEL_ID}". GEMINI_MODEL_ID 환경 변수를 확인하세요.`,
      );
      try {
        const text = await run(FALLBACK_MODEL_ID);
        return text ? { ok: true, text } : { ok: false, kind: "unavailable" };
      } catch (e2: unknown) {
        const kind = classifyGeminiError(e2);
        console.error(`[${label}] Gemini fallback model failed (${kind})`, e2);
        return { ok: false, kind };
      }
    }
    const kind = classifyGeminiError(e);
    console.error(`[${label}] Gemini generateContent failed (${kind})`, e);
    return { ok: false, kind };
  }
}

/**
 * 프롬프트를 보내고 텍스트를 받는다. 실패 시 null (호출부가 사용자 메시지 결정).
 * 실패 원인이 필요한 호출부는 generateGeminiTextResult를 사용할 것.
 */
export async function generateGeminiText(
  prompt: string,
  label: string,
): Promise<string | null> {
  const result = await generateGeminiTextResult(prompt, label);
  return result.ok ? result.text : null;
}
