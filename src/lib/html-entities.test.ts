import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, htmlToPlainText, stripHtmlTags } from "@/lib/html-entities";

describe("decodeHtmlEntities", () => {
  it("감사에서 발견된 실제 사례를 디코딩한다", () => {
    expect(decodeHtmlEntities("&quot;The Lean Startup&quot;")).toBe('"The Lean Startup"');
    expect(decodeHtmlEntities("&#039;memorize&#039;")).toBe("'memorize'");
    expect(decodeHtmlEntities("AI &amp; Context")).toBe("AI & Context");
  });

  it("16진수 숫자 엔티티를 디코딩한다", () => {
    expect(decodeHtmlEntities("&#x27;quoted&#x27;")).toBe("'quoted'");
    expect(decodeHtmlEntities("&#x1F600;")).toBe("😀");
  });

  it("이중 인코딩은 한 단계만 푼다", () => {
    expect(decodeHtmlEntities("&amp;quot;")).toBe("&quot;");
    expect(decodeHtmlEntities("&amp;amp;")).toBe("&amp;");
  });

  it("알 수 없는/잘못된 엔티티는 원문을 유지한다", () => {
    expect(decodeHtmlEntities("&notarealentity;")).toBe("&notarealentity;");
    expect(decodeHtmlEntities("&#xZZZZ;")).toBe("&#xZZZZ;");
    expect(decodeHtmlEntities("&#0;")).toBe("&#0;");
    expect(decodeHtmlEntities("&#9999999999;")).toBe("&#9999999999;");
    expect(decodeHtmlEntities("a & b")).toBe("a & b");
  });
});

describe("stripHtmlTags / htmlToPlainText", () => {
  it("태그를 제거하고 텍스트만 남긴다", () => {
    expect(htmlToPlainText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("태그 제거 후 엔티티를 디코딩한다 (순서 보장)", () => {
    expect(htmlToPlainText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
    // 엔티티로 표현된 꺾쇠는 태그가 아니라 텍스트로 살아남아야 한다
    expect(htmlToPlainText("x &lt;b&gt; y")).toBe("x <b> y");
  });

  it("스크립트 태그도 실행 없이 텍스트만 남긴다", () => {
    expect(htmlToPlainText('<script>alert("x")</script>done')).toBe('alert("x") done');
    expect(stripHtmlTags("<img src=x onerror=alert(1)>safe")).toBe(" safe");
  });

  it("실제 태그만 제거하고 리터럴 꺾쇠 텍스트는 보존한다 (화이트리스트)", () => {
    // 요약에서도 비-HTML 꺾쇠는 살아남아야 한다 (FIX-1 회귀 방지)
    expect(htmlToPlainText("works when x < 10 and y > 5")).toBe("works when x < 10 and y > 5");
    expect(htmlToPlainText("Vec<T> generic container")).toBe("Vec<T> generic container");
    // 알려진 태그는 여전히 제거
    expect(htmlToPlainText("<div>a</div><span>b</span>")).toBe("a b");
  });

  it("제목은 태그 제거 없이 디코딩만 한다 (stripTags: false)", () => {
    expect(htmlToPlainText("Understanding Vec<T> in Rust", { stripTags: false })).toBe(
      "Understanding Vec<T> in Rust",
    );
    expect(htmlToPlainText("x < 10 and y > 5", { stripTags: false })).toBe("x < 10 and y > 5");
    expect(htmlToPlainText("&quot;The Lean Startup&quot;", { stripTags: false })).toBe(
      '"The Lean Startup"',
    );
  });

  it("빈 입력과 공백을 정리한다", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("  a\n\n b  ")).toBe("a b");
  });
});
