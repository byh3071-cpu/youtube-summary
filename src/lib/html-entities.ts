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
  nbsp: " ",
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

// 실제 HTML 태그명 화이트리스트. 이 목록의 태그(여닫기·자기닫기)와 주석만 제거하고,
// `Vec<T>`·`x < 10 and y > 5` 같은 리터럴 꺾쇠 텍스트는 보존한다.
const HTML_TAG_NAMES = [
  "a","abbr","address","area","article","aside","audio","b","bdi","bdo","blockquote",
  "br","button","canvas","caption","cite","code","col","colgroup","data","datalist",
  "dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset",
  "figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","head","header",
  "hgroup","hr","i","iframe","img","input","ins","kbd","label","legend","li","main",
  "map","mark","menu","meta","nav","object","ol","optgroup","option","output","p",
  "param","picture","pre","progress","q","rp","rt","ruby","s","samp","section","select",
  "small","source","span","strong","style","sub","summary","sup","svg","table","tbody",
  "td","template","textarea","tfoot","th","thead","time","tr","track","u","ul","var",
  "video","wbr","script","noscript","path","g","rect","circle","line","polygon",
].join("|");

const HTML_TAG_RE = new RegExp(`<\\/?(?:${HTML_TAG_NAMES})\\b[^>]*>|<!--[\\s\\S]*?-->`, "gi");

/**
 * 알려진 HTML 태그와 주석만 제거한다 (공백으로 치환).
 * 화이트리스트 방식이라 비-HTML 꺾쇠 텍스트(`Vec<T>`, `x < 10 and y > 5`)는 건드리지 않는다.
 */
export function stripHtmlTags(input: string): string {
  if (!input) return input;
  return input.replace(HTML_TAG_RE, " ");
}

/**
 * RSS title/summary용 플레인 텍스트 변환.
 * - 기본(요약 등): 알려진 태그 제거 → 엔티티 디코딩 → 공백 정리.
 * - `stripTags: false`(제목): 태그 제거 없이 엔티티 디코딩만. RSS 제목은 플레인 텍스트가
 *   원칙이라 `Vec<T>` 같은 리터럴 꺾쇠를 절대 깨뜨리지 않는다.
 * 순서가 중요: 태그 제거를 먼저 하면 디코딩으로 생긴 `<` `>`는 텍스트로 남고
 * React가 이스케이프해 렌더링하므로 안전하다.
 */
export function htmlToPlainText(input: string, options?: { stripTags?: boolean }): string {
  if (!input) return "";
  const stripTags = options?.stripTags ?? true;
  const tagless = stripTags ? stripHtmlTags(input) : input;
  return decodeHtmlEntities(tagless).replace(/\s+/g, " ").trim();
}
