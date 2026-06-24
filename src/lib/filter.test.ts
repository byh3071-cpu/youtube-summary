import { describe, it, expect } from "vitest";
import { filterFeedByTrendKeyword } from "@/lib/filter";
import type { FeedItem } from "@/types/feed";

/**
 * filterFeedByTrendKeyword 의 "현재 동작"을 잠그는 회귀 테스트.
 * - 트렌드 키워드 클릭 시 임시 필터(필터에 저장 안 함) 로직.
 * - 매칭 두 갈래: (a) sampleTitles 제목 일치, (b) 토큰 부분 매칭(threshold).
 * - PAT-001/002: LLM이 준 samples에 비문자열이 섞여도 throw 금지(렌더 크래시 방지).
 */

// FeedItem 최소 필드만 채우는 헬퍼 (제목이 매칭 대상의 핵심).
function mk(id: string, title: string, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    title,
    link: "",
    pubDate: "",
    source: "YouTube",
    sourceId: "",
    sourceName: "",
    ...extra,
  };
}

const ids = (items: FeedItem[]) => items.map((i) => i.id);

describe("filterFeedByTrendKeyword — keyword 가드", () => {
  const items = [mk("a", "AI 활용 가이드"), mk("b", "요리 레시피")];

  it("keyword 가 null 이면 items 전체를 그대로 반환한다", () => {
    expect(filterFeedByTrendKeyword(items, null)).toBe(items);
  });

  it("keyword 가 빈 문자열이면 items 전체를 반환한다", () => {
    expect(filterFeedByTrendKeyword(items, "")).toBe(items);
  });

  it("keyword 가 공백뿐이면 items 전체를 반환한다", () => {
    expect(filterFeedByTrendKeyword(items, "   ")).toBe(items);
  });
});

describe("filterFeedByTrendKeyword — phrase(구절 통째) 매칭", () => {
  it("제목에 키워드 구절이 통째로 들어있으면 매칭된다", () => {
    const items = [
      mk("hit", "올해의 AI 모델 활용 정리"), // "ai 모델 활용" 구절 포함
      mk("miss", "주말 캠핑 브이로그"),
    ];
    // 3토큰이지만 phrase 통째 포함이라 threshold 와 무관하게 통과.
    expect(ids(filterFeedByTrendKeyword(items, "AI 모델 활용"))).toEqual(["hit"]);
  });

  it("summary/sourceName 까지 합친 검색 대상에서 구절을 찾는다", () => {
    const items = [
      mk("s", "그냥 제목", { summary: "본문에 ai 모델 활용 사례가 있다" }),
      mk("n", "다른 제목", { summary: "관련 없는 내용" }),
    ];
    expect(ids(filterFeedByTrendKeyword(items, "AI 모델 활용"))).toEqual(["s"]);
  });
});

describe("filterFeedByTrendKeyword — sampleTitles 매칭", () => {
  it("정방향: 제목이 sample 을 포함하면 매칭된다", () => {
    const items = [
      mk("hit", "신작 AI 모델 활용법 완전정복 가이드"), // sample 을 부분문자열로 포함
      mk("miss", "전혀 무관한 영상 제목"),
    ];
    // 키워드 토큰으로는 안 맞지만, sample 포함으로 통과해야 한다.
    const out = filterFeedByTrendKeyword(items, "관심사라벨", ["AI 모델 활용법"]);
    expect(ids(out)).toEqual(["hit"]);
  });

  it("역방향 + 길이 가드: 제목 길이>=8 일 때만 sample 이 제목을 포함하는 매칭을 허용한다", () => {
    // 긴 제목(>=8): sample 이 제목을 통째로 포함 → 역방향 매칭 통과.
    const longTitle = mk("long", "AI 모델 활용법 완전정복"); // 정규화 길이 14
    const longOut = filterFeedByTrendKeyword([longTitle], "무관한키워드", [
      "AI 모델 활용법 완전정복 심화편 가이드",
    ]);
    expect(ids(longOut)).toEqual(["long"]);

    // 짧은 제목(<8): sample 이 제목을 포함해도 과매칭 차단 → 제외.
    const shortTitle = mk("short", "AI"); // 정규화 길이 2
    const shortOut = filterFeedByTrendKeyword([shortTitle], "무관한키워드", [
      "AI 모델 활용 가이드",
    ]);
    expect(ids(shortOut)).toEqual([]);
  });

  it("길이 4 미만 sample 은 무시된다(잡음 sample 가드)", () => {
    const items = [mk("a", "짧은 sample 로는 안 잡히는 제목 abc")];
    // sample "abc"(len 3) 는 필터링되어 매칭에 쓰이지 않는다.
    expect(ids(filterFeedByTrendKeyword(items, "무관키워드존재", ["abc"]))).toEqual([]);
  });
});

describe("filterFeedByTrendKeyword — 비문자열 sample 가드 (PAT-001/002 회귀 방지)", () => {
  it("samples 에 null/숫자/undefined 가 섞여도 throw 없이 동작한다", () => {
    const items = [mk("z", "테스트 영상 모음"), mk("n", "무관 영상")];
    // 비문자열이 norm() 에 닿으면 throw → 렌더 크래시. 가드가 걸러야 한다.
    const samples = [null, 123, undefined, "테스트 영상 모음"] as unknown as string[];
    expect(() => filterFeedByTrendKeyword(items, "테스트", samples)).not.toThrow();
    // 유효 문자열 sample("테스트 영상 모음") 로 z 가 매칭된다.
    expect(ids(filterFeedByTrendKeyword(items, "테스트", samples))).toEqual(["z"]);
  });

  it("모든 sample 이 비문자열이어도 토큰 매칭으로 정상 동작한다", () => {
    const items = [mk("a", "테스트 가이드"), mk("b", "요리 영상")];
    const samples = [null, 0, false] as unknown as string[];
    expect(() => filterFeedByTrendKeyword(items, "테스트", samples)).not.toThrow();
    expect(ids(filterFeedByTrendKeyword(items, "테스트", samples))).toEqual(["a"]);
  });
});

describe("filterFeedByTrendKeyword — 토큰 threshold", () => {
  it("1토큰 키워드: threshold=1 (1개 토큰 매칭이면 노출)", () => {
    const items = [
      mk("hit", "데이터 분석 입문"), // "분석" 토큰 매칭
      mk("miss", "여행 브이로그"),
    ];
    expect(ids(filterFeedByTrendKeyword(items, "분석"))).toEqual(["hit"]);
  });

  it("2토큰 키워드: threshold=1 (1개만 맞아도 노출 — 현재 동작 잠금)", () => {
    // 2토큰은 현재 threshold=1 이라 광범위 매칭된다. (작업2 평가 대상)
    const items = [
      mk("a", "AI 모델 비교"), // "ai" 만 매칭(1개)
      mk("b", "데이터 활용 사례"), // "활용" 만 매칭(1개)
      mk("c", "AI 활용 강의"), // 둘 다 매칭
      mk("d", "주말 요리"), // 0개
    ];
    expect(ids(filterFeedByTrendKeyword(items, "AI 활용"))).toEqual(["a", "b", "c"]);
  });

  it("3토큰 이상: threshold=2 (2개 이상 매칭해야 노출, 1개만 매칭은 제외)", () => {
    const items = [
      mk("two", "데이터 분석 강의"), // "데이터"+"분석" 2개 매칭 → 노출
      mk("one", "데이터 센터 투어"), // "데이터" 1개만 → 제외
      mk("zero", "요리 브이로그"), // 0개 → 제외
    ];
    // 키워드 3토큰(데이터/분석/시각화), phrase 통째 매칭은 없음.
    expect(ids(filterFeedByTrendKeyword(items, "데이터 분석 시각화"))).toEqual([
      "two",
    ]);
  });
});

describe("filterFeedByTrendKeyword — ASCII 단어경계 vs 한국어 포함 매칭 (keywordMatches 경유)", () => {
  it("ASCII 토큰은 단어 경계 매칭이라 부분문자열만으로는 안 잡힌다", () => {
    // 키워드 3토큰(java/비교/분석) → threshold=2.
    // 제목 "javascript 비교 자료": java 는 \bjava\b 경계 불일치(javascript), 비교만 매칭 → 1개 < 2 → 제외.
    const items = [mk("A", "javascript 비교 자료")];
    expect(ids(filterFeedByTrendKeyword(items, "java 비교 분석"))).toEqual([]);
  });

  it("ASCII 토큰이 온전한 단어로 있으면 매칭된다", () => {
    const items = [mk("C", "java 비교 분석 정리")];
    // java(경계 일치)+비교 → 2개 → 노출.
    expect(ids(filterFeedByTrendKeyword(items, "java 비교 분석"))).toEqual(["C"]);
  });

  it("한국어 토큰은 포함 매칭이라 부분문자열이어도 잡힌다", () => {
    // 키워드 3토큰(자바/비교/분석) → threshold=2.
    // 제목 "자바스크립트 비교 분석본": 자바(자바스크립트에 포함)+비교+분석(분석본에 포함) → 2개 이상 → 노출.
    const items = [mk("B", "자바스크립트 비교 분석본")];
    expect(ids(filterFeedByTrendKeyword(items, "자바 비교 분석"))).toEqual(["B"]);
  });
});

describe("filterFeedByTrendKeyword — 작업2: 2토큰 threshold 상향 트레이드오프 검증", () => {
  // 결론: threshold 변경 보류. 아래 두 테스트가 현재(threshold=1) 동작을 잠그며,
  // 변경 시(>=2 ? 2 : 1) 빈결과 회귀가 발생함을 명시한다.

  it("[근거1·과매칭] 2토큰 중 1개만 맞는 무관 아이템도 현재는 노출된다", () => {
    // threshold=2 로 올리면 a,b 가 제외되어 과매칭이 줄지만(장점)...
    const items = [
      mk("a", "AI 뉴스 브리핑"), // "ai" 1개
      mk("b", "예산 활용 팁"), // "활용" 1개
      mk("c", "AI 활용 실전"), // 2개
    ];
    expect(ids(filterFeedByTrendKeyword(items, "AI 활용"))).toEqual(["a", "b", "c"]);
  });

  it("[근거2·빈결과 회귀] samples=[] + 2토큰 중 1개씩만 맞는 아이템만 있으면 현재는 비-empty, threshold=2면 0이 된다", () => {
    // sample 폴백이 없는(samples=[]) 현실적 케이스. 모든 아이템이 토큰 1개씩만 매칭.
    const items = [
      mk("x", "AI 뉴스레터 모음"), // "ai" 만
      mk("y", "데이터 활용 사례"), // "활용" 만
    ];
    const out = filterFeedByTrendKeyword(items, "AI 활용", []);
    // 현재 동작(threshold=1): 둘 다 노출 → 빈결과 아님.
    expect(ids(out)).toEqual(["x", "y"]);
    expect(out.length).toBeGreaterThan(0); // threshold=2 였다면 0 → "빈결과 회피" 우선순위 회귀
  });
});
