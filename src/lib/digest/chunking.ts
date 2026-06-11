import type { TranscriptLine } from "../video-transcript";
import { formatTimestamp } from "../video-transcript";

/** 이 길이 이하면 맵 단계 없이 단일 패스로 처리 (≈20분 한국어 영상) */
export const SINGLE_PASS_MAX_CHARS = 12_000;
/** 청크 목표 크기 (≈10~13분 분량) */
export const TARGET_CHUNK_CHARS = 9_000;
/** 문맥 연속성을 위한 이전 청크 꼬리 중복 */
export const CHUNK_OVERLAP_CHARS = 600;
/** 비용 가드 — 초과분은 청크 크기를 키워 흡수 (내용 유실 없음) */
export const MAX_CHUNKS = 12;
/** 이 길이(≈5시간+)를 넘는 초장편만 줄 샘플링으로 축소 */
export const ABSOLUTE_INPUT_CAP = 240_000;

/** 청크 텍스트에서 중복(오버랩) 구간임을 표시하는 마커 — 프롬프트 규칙과 일치해야 함 */
export const OVERLAP_MARKER = "(이전 구간 끝부분 중복 — 분석에서 제외)";

export interface TranscriptChunk {
  index: number;
  startSec: number;
  endSec: number;
  /** "[H:MM:SS] 내용" 줄들로 렌더링된 텍스트 (오버랩 포함 시 마커로 구분) */
  text: string;
}

function lineLength(line: TranscriptLine): number {
  return line.text.length + 1;
}

export function renderLines(lines: TranscriptLine[]): string {
  return lines.map((l) => `[${formatTimestamp(l.offset)}] ${l.text}`).join("\n");
}

/** 총 글자수가 cap 이하가 되도록 줄을 균등 간격으로 추린다 (초장편 전용). */
export function sampleLinesToCap(lines: TranscriptLine[], cap: number): TranscriptLine[] {
  const total = lines.reduce((sum, l) => sum + lineLength(l), 0);
  if (total <= cap) return lines;
  const keepRatio = cap / total;
  const targetCount = Math.max(1, Math.floor(lines.length * keepRatio));
  const step = lines.length / targetCount;
  const out: TranscriptLine[] = [];
  for (let i = 0; i < targetCount; i++) {
    out.push(lines[Math.floor(i * step)]);
  }
  return out;
}

/**
 * 자막 줄을 타임스탬프를 보존한 채 청크로 나눈다.
 * - 줄을 절대 쪼개지 않는다 (타임스탬프 무결성)
 * - 단일 패스 분량이면 청크 1개를 반환한다
 * - MAX_CHUNKS를 넘지 않도록 청크 크기를 키운다
 */
export function chunkTranscript(lines: TranscriptLine[]): TranscriptChunk[] {
  const working = sampleLinesToCap(lines, ABSOLUTE_INPUT_CAP);
  const total = working.reduce((sum, l) => sum + lineLength(l), 0);

  if (working.length === 0) return [];
  if (total <= SINGLE_PASS_MAX_CHARS) {
    return [
      {
        index: 0,
        startSec: working[0].offset,
        endSec: working[working.length - 1].offset,
        text: renderLines(working),
      },
    ];
  }

  const chunkBudget = Math.max(TARGET_CHUNK_CHARS, Math.ceil(total / MAX_CHUNKS));

  const groups: TranscriptLine[][] = [];
  let current: TranscriptLine[] = [];
  let currentSize = 0;
  for (const line of working) {
    if (currentSize + lineLength(line) > chunkBudget && current.length > 0) {
      groups.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(line);
    currentSize += lineLength(line);
  }
  if (current.length > 0) groups.push(current);

  // 그리디 분할은 예산 미만으로 닫히며 스필오버가 생길 수 있다 —
  // MAX_CHUNKS 초과분은 마지막 청크에 병합해 상한을 보장한다.
  while (groups.length > MAX_CHUNKS) {
    const overflow = groups.pop()!;
    groups[groups.length - 1] = groups[groups.length - 1].concat(overflow);
  }

  return groups.map((group, index) => {
    let text = renderLines(group);
    if (index > 0) {
      // 이전 청크 꼬리를 중복 포함해 문맥을 잇는다 (마커로 분석 제외 표시)
      const prev = groups[index - 1];
      const tail: TranscriptLine[] = [];
      let tailSize = 0;
      for (let i = prev.length - 1; i >= 0; i--) {
        const size = lineLength(prev[i]);
        if (tailSize + size > CHUNK_OVERLAP_CHARS) break;
        tail.unshift(prev[i]);
        tailSize += size;
      }
      if (tail.length > 0) {
        text = `${OVERLAP_MARKER}\n${renderLines(tail)}\n(여기부터 이 구간의 본문)\n${text}`;
      }
    }
    return {
      index,
      startSec: group[0].offset,
      endSec: group[group.length - 1].offset,
      text,
    };
  });
}
