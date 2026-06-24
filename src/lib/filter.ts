import { FeedItem } from "../types/feed";
import type { FeedCategory } from "../types/feed";

/**
 * 주어진 피드 목록을 사용자의 관심사(키워드) 배열에 맞게 필터링합니다.
 * 키워드가 비어있다면 전체 목록을 반환합니다.
 */
/** ASCII 전용 키워드(영어 등)는 단어 경계 매칭, 그 외(한국어 등)는 포함 매칭 */
function keywordMatches(keyword: string, target: string): boolean {
    if (/^[a-zA-Z0-9 ]+$/.test(keyword)) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(target);
    }
    return target.includes(keyword);
}

export function filterFeedByKeywords(items: FeedItem[], keywords: string[]): FeedItem[] {
    if (!keywords || keywords.length === 0) {
        return items;
    }

    const lowerCaseKeywords = keywords.map(k => k.toLowerCase());

    return items.filter(item => {
        const searchTarget = `${item.title} ${item.summary || ''} ${item.sourceName}`.toLowerCase();

        // 하나라도 매칭되면 노출 (OR 조건)
        return lowerCaseKeywords.some(keyword => keywordMatches(keyword, searchTarget));
    });
}

/**
 * 트렌드 키워드 하나로 피드를 임시 필터링합니다.
 * (요즘 뜨는 키워드 클릭 시 사용, 필터에 저장하지 않음)
 */
export function filterFeedByTrendKeyword(
  items: FeedItem[],
  keyword: string | null,
  samples: string[] = [],
): FeedItem[] {
  if (!keyword || !keyword.trim()) return items;
  const phrase = keyword.toLowerCase().trim();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const searchTarget = (item: FeedItem) =>
    `${item.title} ${item.summary || ""} ${item.sourceName}`.toLowerCase();

  // 트렌드 키워드("AI 모델 활용" 등)는 AI가 만든 추상 라벨이라 영상 제목에 구절이 통째로
  // 들어있지 않다 → 구절 포함만 보면 결과 0. 그래서 두 갈래로 매칭한다.
  // (a) sampleTitles: 그 트렌드의 대표 영상 제목들(실제 피드에서 뽑힘) → 제목 일치로 정확 매칭
  // (b) 토큰 부분 매칭: 키워드를 단어로 쪼개 일부만 맞아도 노출(폴백/확장)
  // LLM이 준 sampleTitles에 비문자열(null·숫자)이 섞이면 norm()이 throw → 렌더 크래시(PAT-001/002).
  // 문자열만 받아 정규화하고 너무 짧은 건 제외.
  const sampleNorms = samples.filter((s) => typeof s === "string").map(norm).filter((s) => s.length >= 4);

  const tokens = phrase.split(/\s+/).filter((t) => t.length >= 2);
  // 1~2 토큰: 1개만 맞아도 / 3 토큰 이상: 2개 이상(과매칭 방지). 단 sample 매칭은 항상 통과.
  // 2토큰 threshold 상향(>=2 ? 2 : 1)은 sample 부재 시 빈결과 회귀 → 보류.
  // (samples=[] 이고 2토큰 중 1개씩만 맞는 아이템들만 있으면 threshold=2는 결과 0 → "빈결과 회피" 우선순위 위반. filter.test.ts가 회귀로 잠금)
  const threshold = tokens.length >= 3 ? 2 : 1;

  return items.filter((item) => {
    const titleNorm = norm(item.title);
    // (a) 대표 제목과 부분 일치. 역방향(sample이 제목을 포함)은 제목이 짧을수록 무관한 영상까지
    // 빨려드는 과매칭이라("AI"가 "AI 모델 활용법"의 부분문자열) 제목 길이 하한을 둔다.
    for (const s of sampleNorms) {
      if (titleNorm.includes(s) || (titleNorm.length >= 8 && s.includes(titleNorm))) return true;
    }
    // (b) 토큰 매칭
    const target = searchTarget(item);
    if (target.includes(phrase)) return true;
    if (tokens.length === 0) return false;
    let hits = 0;
    for (const tok of tokens) {
      if (keywordMatches(tok, target)) {
        hits += 1;
        if (hits >= threshold) return true;
      }
    }
    return false;
  });
}

/**
 * 검색어로 피드를 필터링합니다.
 * 제목, 소스 이름, 요약에서 검색어가 포함된 항목만 반환합니다.
 */
export function filterFeedBySearch(items: FeedItem[], query: string): FeedItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.sourceName.toLowerCase().includes(q) ||
    (item.summary?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * 카테고리 기준으로 피드를 필터링합니다.
 * category가 없으면 전체, 있으면 해당 카테고리만 반환합니다.
 */
export function filterFeedByCategory(items: FeedItem[], category: FeedCategory | null): FeedItem[] {
    if (!category) {
        return items;
    }
    return items.filter((item) => item.category === category);
}
