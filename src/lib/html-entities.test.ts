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

  it("빈 입력과 공백을 정리한다", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("  a\n\n b  ")).toBe("a b");
  });
});
