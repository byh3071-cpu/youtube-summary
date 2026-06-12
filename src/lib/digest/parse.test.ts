import { describe, expect, it } from "vitest";
import { safeParseChunkDigest, safeParseVideoDigest } from "./parse";
import { parseTimestampToSeconds } from "./types";

const validDigest = {
  headline: "테스트 헤드라인",
  coreValue: "이 영상을 봐야 하는 이유",
  summary: "요약 문장입니다. 네 문장 이상이라고 가정합니다.",
  keyInsights: [
    { insight: "인사이트1", evidence: "근거1", timestamp: "12:34" },
    { insight: "인사이트2", evidence: "근거2", timestamp: "잘못된값" },
  ],
  keywords: ["AI", "에이전트", "ai", "자동화"],
  quotes: [
    { text: "인용문", timestamp: "47:21" },
    { text: "타임스탬프 없는 인용", timestamp: null },
  ],
  sections: [
    { timestamp: "31:00", title: "뒤 섹션", points: ["요점"] },
    { timestamp: "00:10", title: "앞 섹션", points: [] },
  ],
  actions: ["액션1"],
  openQuestions: ["질문1"],
  category: "AI/자동화",
  tags: ["AI/LLM", "허용목록에없는태그"],
};

describe("parseTimestampToSeconds", () => {
  it("MM:SS / H:MM:SS를 초로 변환한다", () => {
    expect(parseTimestampToSeconds("12:34")).toBe(754);
    expect(parseTimestampToSeconds("1:02:30")).toBe(3750);
  });
  it("형식이 어긋나면 undefined", () => {
    expect(parseTimestampToSeconds("abc")).toBeUndefined();
    expect(parseTimestampToSeconds("12:99")).toBeUndefined();
    expect(parseTimestampToSeconds(null)).toBeUndefined();
  });
});

describe("safeParseVideoDigest", () => {
  it("코드 펜스로 감싼 JSON을 파싱한다", () => {
    const raw = "```json\n" + JSON.stringify(validDigest) + "\n```";
    const digest = safeParseVideoDigest(raw, { hasTimestamps: true });
    expect(digest).not.toBeNull();
    expect(digest!.headline).toBe("테스트 헤드라인");
  });

  it("seconds를 코드에서 파생하고 잘못된 타임스탬프는 null 처리한다", () => {
    const digest = safeParseVideoDigest(JSON.stringify(validDigest), { hasTimestamps: true })!;
    expect(digest.keyInsights[0].timestamp).toBe("12:34");
    expect(digest.keyInsights[0].seconds).toBe(754);
    expect(digest.keyInsights[1].timestamp).toBeNull();
    expect(digest.keyInsights[1].seconds).toBeUndefined();
  });

  it("자막 기반에서 타임스탬프 없는 인용은 제외한다", () => {
    const digest = safeParseVideoDigest(JSON.stringify(validDigest), { hasTimestamps: true })!;
    expect(digest.quotes).toHaveLength(1);
    expect(digest.quotes[0].timestamp).toBe("47:21");
  });

  it("스니펫 모드는 모든 타임스탬프를 null로 강제하고 인용은 유지한다", () => {
    const digest = safeParseVideoDigest(JSON.stringify(validDigest), { hasTimestamps: false })!;
    expect(digest.keyInsights[0].timestamp).toBeNull();
    expect(digest.quotes.length).toBeGreaterThan(0);
    expect(digest.quotes.every((q) => q.timestamp === null)).toBe(true);
  });

  it("키워드를 대소문자 무시로 중복 제거한다", () => {
    const digest = safeParseVideoDigest(JSON.stringify(validDigest), { hasTimestamps: true })!;
    expect(digest.keywords).toEqual(["AI", "에이전트", "자동화"]);
  });

  it("섹션을 시간순으로 정렬한다", () => {
    const digest = safeParseVideoDigest(JSON.stringify(validDigest), { hasTimestamps: true })!;
    expect(digest.sections[0].title).toBe("앞 섹션");
    expect(digest.sections[1].title).toBe("뒤 섹션");
  });

  it("허용 목록 밖의 category/tags를 걸러낸다", () => {
    const digest = safeParseVideoDigest(JSON.stringify(validDigest), { hasTimestamps: true })!;
    expect(digest.category).toBe("AI/자동화");
    expect(digest.tags).toEqual(["AI/LLM"]);
  });

  it("maxSeconds: 영상 길이를 초과하는 환각 타임스탬프를 null로 만든다", () => {
    const hallucinated = {
      ...validDigest,
      keyInsights: [{ insight: "초과", evidence: "e", timestamp: "1:21:49" }], // 4909s
      quotes: [{ text: "끝 너머 인용", timestamp: "1:30:00" }], // 5400s
      sections: [
        { timestamp: "10:00", title: "정상", points: [] }, // 600s
        { timestamp: "1:25:00", title: "초과", points: [] }, // 5100s
      ],
    };
    // 70분(4235s) 영상 + 60s 허용 → 4295s 초과는 null
    const digest = safeParseVideoDigest(JSON.stringify(hallucinated), {
      hasTimestamps: true,
      maxSeconds: 4235,
    })!;
    expect(digest.keyInsights[0].timestamp).toBeNull();
    expect(digest.keyInsights[0].seconds).toBeUndefined();
    // 자막 모드에서 타임스탬프 없는 인용은 제외되므로 quotes는 비어야 함
    expect(digest.quotes).toHaveLength(0);
    // 정상 섹션만 타임스탬프 유지, 초과 섹션은 null(정렬상 뒤로)
    const valid = digest.sections.filter((s) => s.timestamp !== null);
    expect(valid).toHaveLength(1);
    expect(valid[0].timestamp).toBe("10:00");
  });

  it("maxSeconds 미지정 시 가드를 적용하지 않는다 (debug/스니펫 호환)", () => {
    const digest = safeParseVideoDigest(
      JSON.stringify({
        ...validDigest,
        sections: [{ timestamp: "9:99:99", title: "x", points: [] }],
      }),
      { hasTimestamps: true },
    )!;
    // 9:99:99는 형식 불일치라 어차피 null이지만, 정상 큰 값은 통과해야 함
    const big = safeParseVideoDigest(
      JSON.stringify({ ...validDigest, sections: [{ timestamp: "5:00:00", title: "x", points: [] }] }),
      { hasTimestamps: true },
    )!;
    expect(big.sections[0].timestamp).toBe("5:00:00");
    expect(digest).toBeTruthy();
  });

  it("배열 상한을 강제한다 (키워드 10개)", () => {
    const many = {
      ...validDigest,
      keywords: Array.from({ length: 15 }, (_, i) => `키워드${i}`),
    };
    const digest = safeParseVideoDigest(JSON.stringify(many), { hasTimestamps: true })!;
    expect(digest.keywords).toHaveLength(10);
  });

  it("headline이 없으면 실패한다", () => {
    const broken = { ...validDigest, headline: "" };
    expect(safeParseVideoDigest(JSON.stringify(broken), { hasTimestamps: true })).toBeNull();
  });

  it("JSON이 아니면 실패한다", () => {
    expect(safeParseVideoDigest("이건 JSON이 아님", { hasTimestamps: true })).toBeNull();
  });
});

describe("safeParseChunkDigest", () => {
  it("정상 청크 출력을 파싱한다", () => {
    const chunk = {
      partSummary: "구간 요약",
      insights: [{ insight: "i", evidence: "e", timestamp: "01:00" }],
      keywords: ["a", "b"],
      quotes: [{ text: "q", timestamp: "02:00" }],
      sections: [{ timestamp: "00:00", title: "t", points: ["p"] }],
    };
    const parsed = safeParseChunkDigest(JSON.stringify(chunk));
    expect(parsed).not.toBeNull();
    expect(parsed!.insights[0].seconds).toBe(60);
  });

  it("partSummary가 없으면 실패한다", () => {
    expect(safeParseChunkDigest(JSON.stringify({ insights: [] }))).toBeNull();
  });
});
