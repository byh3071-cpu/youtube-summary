import { describe, expect, it } from "vitest";
import type { TranscriptLine } from "../video-transcript";
import {
  ABSOLUTE_INPUT_CAP,
  CHUNK_OVERLAP_CHARS,
  MAX_CHUNKS,
  OVERLAP_MARKER,
  SINGLE_PASS_MAX_CHARS,
  chunkTranscript,
  sampleLinesToCap,
} from "./chunking";

function makeLines(count: number, charsPerLine: number): TranscriptLine[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `${i}번째줄`.padEnd(charsPerLine, "가"),
    offset: i * 5,
  }));
}

function totalChars(lines: TranscriptLine[]): number {
  return lines.reduce((sum, l) => sum + l.text.length + 1, 0);
}

describe("chunkTranscript", () => {
  it("짧은 자막은 청크 1개(단일 패스)로 반환한다", () => {
    const lines = makeLines(50, 40); // ~2,000자
    const chunks = chunkTranscript(lines);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(49 * 5);
  });

  it("단일 패스 경계를 넘으면 여러 청크로 나눈다", () => {
    const lines = makeLines(600, 80); // ~48,000자 (1시간 분량 근사)
    const chunks = chunkTranscript(lines);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNKS);
  });

  it("아주 긴 입력도 MAX_CHUNKS를 넘지 않는다 (청크 크기 성장)", () => {
    const lines = makeLines(2000, 75); // ~150,000자 (3시간 분량 근사)
    const chunks = chunkTranscript(lines);
    expect(chunks.length).toBeLessThanOrEqual(MAX_CHUNKS);
  });

  it("두 번째 청크부터 오버랩 마커와 이전 꼬리 내용을 포함한다", () => {
    const lines = makeLines(600, 80);
    const chunks = chunkTranscript(lines);
    expect(chunks[1].text.startsWith(OVERLAP_MARKER)).toBe(true);
    expect(chunks[1].text).toContain("(여기부터 이 구간의 본문)");
    // 마커~본문 사이(오버랩)가 CHUNK_OVERLAP_CHARS 예산 내인지
    const overlapPart = chunks[1].text.split("(여기부터 이 구간의 본문)")[0];
    expect(overlapPart.length).toBeLessThanOrEqual(
      OVERLAP_MARKER.length + CHUNK_OVERLAP_CHARS + 200, // 타임스탬프 렌더링 여유
    );
  });

  it("줄을 쪼개지 않고 타임스탬프 표기를 보존한다", () => {
    const lines = makeLines(600, 80);
    const chunks = chunkTranscript(lines);
    // 모든 청크 본문 줄이 [MM:SS] 형태로 시작
    for (const chunk of chunks) {
      const body = chunk.text.split("(여기부터 이 구간의 본문)\n").pop()!;
      for (const row of body.split("\n")) {
        expect(row).toMatch(/^\[\d{1,2}:\d{2}(:\d{2})?\] /);
      }
    }
  });

  it("경계값: SINGLE_PASS_MAX_CHARS 직하 입력은 청크 1개", () => {
    const charsPerLine = 100;
    const count = Math.floor(SINGLE_PASS_MAX_CHARS / (charsPerLine + 1));
    const chunks = chunkTranscript(makeLines(count, charsPerLine));
    expect(chunks).toHaveLength(1);
  });
});

describe("sampleLinesToCap", () => {
  it("cap 이하 입력은 그대로 반환한다", () => {
    const lines = makeLines(100, 50);
    expect(sampleLinesToCap(lines, ABSOLUTE_INPUT_CAP)).toBe(lines);
  });

  it("cap 초과 입력은 균등 샘플링으로 cap 이하가 된다", () => {
    const lines = makeLines(4000, 80); // ~324,000자 > 240,000
    const sampled = sampleLinesToCap(lines, ABSOLUTE_INPUT_CAP);
    expect(totalChars(sampled)).toBeLessThanOrEqual(ABSOLUTE_INPUT_CAP);
    // 시간순 유지
    for (let i = 1; i < sampled.length; i++) {
      expect(sampled[i].offset).toBeGreaterThan(sampled[i - 1].offset);
    }
  });
});
