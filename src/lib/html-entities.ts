/**
 * 서버 환경(DOM 없음)에서 동작하는 HTML 엔티티 디코딩·태그 제거 유틸.
 * 임의 HTML을 렌더링하거나 스크립트를 실행하지 않는다 — 순수 문자열 변환만 수행.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  laquo: "«",
  raquo: "»",
  deg: "°",
  times: "×",
  eacute: "é",
};

const ENTITY_RE = /&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

/**
 * HTML 엔티티를 1회 디코딩한다 (`&quot;` → `"`, `&#039;` → `'`, `&#x27;` → `'`).
 * 알 수 없는/잘못된 엔티티는 원문 그대로 둔다. 이중 인코딩(`&amp;quot;`)은 한 단계만 풀린다.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes("&")) return input;
  return input.replace(ENTITY_RE, (match, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1] === "x" || body[1] === "X";
      const digits = body.slice(isHex ? 2 : 1);
      if (!isHex && !/^[0-9]+$/.test(digits)) return match;
      const code = parseInt(digits, isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      // surrogate 범위는 fromCodePoint가 throw하므로 원문 유지
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** HTML 태그를 제거하고 공백을 정리한다. */
export function stripHtmlTags(input: string): string {
  if (!input) return input;
  return input.replace(/<[^>]*>/g, " ");
}

/**
 * RSS title/summary용 플레인 텍스트 변환.
 * 순서가 중요: ① 실제 태그 제거 → ② 엔티티 디코딩.
 * (반대 순서면 `&lt;b&gt;` 같은 텍스트가 태그로 오인돼 본문이 잘릴 수 있다.
 *  디코딩으로 생긴 `<` `>`는 그대로 텍스트로 남고, React가 이스케이프해 렌더링하므로 안전.)
 */
export function htmlToPlainText(input: string): string {
  if (!input) return "";
  return decodeHtmlEntities(stripHtmlTags(input)).replace(/\s+/g, " ").trim();
}
