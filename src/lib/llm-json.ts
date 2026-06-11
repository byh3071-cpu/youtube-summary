/**
 * LLM 텍스트 응답에서 ```json 코드 펜스·잡설을 벗겨내고
 * 가장 바깥 JSON 객체 문자열을 추출한다. (JSON.parse는 호출부에서)
 * 객체 중괄호를 못 찾으면 펜스만 벗긴 문자열을 그대로 반환한다.
 */
export function extractJsonObject(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}") + 1;
  return start >= 0 && end > start ? trimmed.slice(start, end) : trimmed;
}
