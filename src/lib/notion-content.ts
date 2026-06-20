import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import type {
  SectionAnalysis,
  VideoAnalysis,
  BriefingHint,
} from "./notion-section-analyzer";
import type { StructuredVideoContext } from "./video-transcript";
import { formatTimestamp } from "./video-transcript";

const RICH_TEXT_MAX = 1900;
const TOGGLE_CHILD_MAX = 90;

function rt(content: string): { type: "text"; text: { content: string } }[] {
  return [{ type: "text", text: { content: content.slice(0, RICH_TEXT_MAX) } }];
}

function paragraph(text: string): BlockObjectRequest {
  return { type: "paragraph", paragraph: { rich_text: rt(text) } };
}

function heading2(text: string): BlockObjectRequest {
  return { type: "heading_2", heading_2: { rich_text: rt(text) } };
}

function heading3(text: string): BlockObjectRequest {
  return { type: "heading_3", heading_3: { rich_text: rt(text) } };
}

function bullet(text: string): BlockObjectRequest {
  return {
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: rt(text) },
  };
}

function divider(): BlockObjectRequest {
  return { type: "divider", divider: {} };
}

function callout(text: string, emoji = "💡"): BlockObjectRequest {
  return {
    type: "callout",
    callout: { rich_text: rt(text), icon: { type: "emoji", emoji: emoji as never } },
  };
}

function quote(text: string): BlockObjectRequest {
  return { type: "quote", quote: { rich_text: rt(text) } };
}

function toggle(label: string, children: BlockObjectRequest[]): BlockObjectRequest {
  return {
    type: "toggle",
    toggle: {
      rich_text: rt(label),
      children: children.slice(0, TOGGLE_CHILD_MAX),
    },
  } as BlockObjectRequest;
}

function chunkText(text: string, max = 1500): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + max, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > i + max * 0.5) end = lastSpace;
    }
    out.push(text.slice(i, end).trim());
    i = end;
  }
  return out.filter((s) => s.length > 0);
}

export function buildResourceBody(args: {
  context: StructuredVideoContext;
  originalUrl: string;
  channel?: string | null;
  collectedDate: string;
}): BlockObjectRequest[] {
  const { context, originalUrl, channel, collectedDate } = args;
  const blocks: BlockObjectRequest[] = [];

  blocks.push(
    callout(`원본 URL: ${originalUrl}`, "🔗"),
    paragraph(
      `채널: ${channel ?? "—"}    수집일: ${collectedDate}    유형: 영상 (유튜브)`,
    ),
    divider(),
  );

  if ("error" in context) {
    blocks.push(paragraph(`(자막/원문을 가져오지 못했습니다: ${context.error})`));
    return blocks;
  }

  if (context.mode === "transcript") {
    const lines = context.lines;
    const groupSize = 6;
    const groupedParagraphs: BlockObjectRequest[] = [];
    for (let i = 0; i < lines.length; i += groupSize) {
      const slice = lines.slice(i, i + groupSize);
      const first = slice[0];
      const text = `[${formatTimestamp(first.offset)}] ${slice
        .map((l) => l.text)
        .join(" ")}`;
      for (const chunk of chunkText(text)) {
        groupedParagraphs.push(paragraph(chunk));
      }
    }

    if (groupedParagraphs.length <= TOGGLE_CHILD_MAX) {
      blocks.push(toggle("📝 자막 원문 (펼쳐서 보기)", groupedParagraphs));
    } else {
      const segments = Math.ceil(groupedParagraphs.length / TOGGLE_CHILD_MAX);
      for (let s = 0; s < segments; s++) {
        const segChildren = groupedParagraphs.slice(
          s * TOGGLE_CHILD_MAX,
          (s + 1) * TOGGLE_CHILD_MAX,
        );
        blocks.push(
          toggle(`📝 자막 원문 (${s + 1}/${segments})`, segChildren),
        );
      }
    }
  } else {
    const children: BlockObjectRequest[] = [];
    for (const chunk of chunkText(context.text)) {
      children.push(paragraph(chunk));
    }
    blocks.push(toggle("📝 제목·설명 원문", children));
  }

  return blocks;
}

function sectionToBlocks(section: SectionAnalysis): BlockObjectRequest[] {
  const headingText = section.timestamp
    ? `${section.timestamp} — ${section.title}`
    : section.title;
  const out: BlockObjectRequest[] = [heading3(headingText)];
  for (const point of section.points) {
    out.push(bullet(point));
  }
  if (section.excerpt) {
    out.push(toggle("자막 발췌", [quote(section.excerpt)]));
  }
  return out;
}

export function buildSummaryBody(args: {
  analysis: VideoAnalysis;
  hint?: BriefingHint;
  resourceUrl?: string;
}): BlockObjectRequest[] {
  const { analysis, hint, resourceUrl } = args;
  const blocks: BlockObjectRequest[] = [];

  blocks.push(callout(`💡 ${analysis.headline}`, "💡"));
  if (resourceUrl) {
    blocks.push(paragraph(`원본 RESOURCE: ${resourceUrl}`));
  }
  blocks.push(divider());

  blocks.push(heading2("1차 요약 (객관)"));
  for (const chunk of chunkText(analysis.summary)) {
    blocks.push(paragraph(chunk));
  }

  if (analysis.sections.length > 0) {
    blocks.push(heading3("섹션별 정리"));
    for (const section of analysis.sections) {
      blocks.push(...sectionToBlocks(section));
    }
  }

  blocks.push(divider());
  blocks.push(heading2("2차 보강 (요한 OS 맥락)"));

  if (hint?.why) {
    blocks.push(heading3("포커스 피드 추천 이유"));
    blocks.push(paragraph(hint.why));
  }
  if (hint?.action) {
    blocks.push(heading3("이번 주 액션"));
    blocks.push(paragraph(hint.action));
  }
  if (hint?.priority != null || hint?.score != null) {
    const priorityText = hint.priority != null ? `${hint.priority}순위` : "—";
    const scoreText = hint.score != null ? `${Math.round(hint.score)}점` : "—";
    blocks.push(heading3("우선순위 / 적합도"));
    blocks.push(paragraph(`${priorityText} / 적합도 ${scoreText}`));
  }

  if (analysis.openQuestions.length > 0) {
    blocks.push(heading3("잔여 갭 / 후속 질문"));
    for (const q of analysis.openQuestions) {
      blocks.push(bullet(q));
    }
  }

  if (analysis.triples.length > 0) {
    blocks.push(divider());
    blocks.push(heading2("트리플 맵 (관계 후보)"));
    for (const t of analysis.triples) {
      blocks.push(
        bullet(
          `${t.subject} --${t.relation}--> ${t.object}  ·${t.domain} ·신뢰도 ${t.confidence}`,
        ),
      );
    }
    blocks.push(
      paragraph(
        "_검토 후 triple-map.md / 트리플맵 DB로 승급. 자동 확정 아님 (R3 후보)._",
      ),
    );
  }

  if (analysis.people.length > 0 || analysis.concepts.length > 0) {
    blocks.push(heading3("인물·개념 (후보)"));
    for (const p of analysis.people) {
      blocks.push(bullet(`👤 ${p.name}${p.role ? ` — ${p.role}` : ""}`));
    }
    for (const c of analysis.concepts) {
      blocks.push(bullet(`📎 ${c}`));
    }
    blocks.push(
      paragraph("_검토 후 인물 DB / AI 사전으로 승급 (R3 후보)._"),
    );
  }

  blocks.push(heading3("매핑 / 보완 (직접 작성)"));
  blocks.push(
    paragraph(
      "_AI가 자동으로 채우지 않은 부분. 요한 OS와의 매핑, 보완완료 항목, 대조군 관찰을 직접 추가하세요._",
    ),
  );

  return blocks;
}
