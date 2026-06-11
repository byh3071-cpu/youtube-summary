"use server";

import {
  getNotionEnv,
  findResourceByUrl,
  NOTION_RESOURCE_DS_ID,
  NOTION_SUMMARY_DS_ID,
} from "@/lib/notion-client";
import { getStructuredVideoContext } from "@/lib/video-transcript";
import {
  analyzeVideoForNotion,
  type BriefingHint,
} from "@/lib/notion-section-analyzer";
import { buildResourceBody, buildSummaryBody } from "@/lib/notion-content";

export type NotionSyncResult =
  | { ok: true; resourceUrl: string; summaryUrl: string; reused?: boolean }
  | { ok: true; alreadyExists: true; summaryUrl?: string }
  | { error: string };

function buildPageTitle(prefix: string, videoTitle: string, channel?: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  const channelPart = channel ? ` — ${channel}` : "";
  return `[${today}] ${prefix}${videoTitle}${channelPart}`;
}

export async function syncVideoToNotionAction(args: {
  videoId: string;
  title: string;
  channel?: string | null;
  durationMinutes?: number | null;
  hint?: BriefingHint;
}): Promise<NotionSyncResult> {
  const { videoId, title, channel, durationMinutes, hint } = args;
  if (!videoId || !title) {
    return { error: "videoId와 title이 필요합니다." };
  }

  // AI 섹션 분석에 필수 — 노션 조회·자막 추출 전에 빠르게 실패시킨다.
  if (!process.env.GEMINI_API_KEY) {
    return { error: ".env.local 파일에 GEMINI_API_KEY 설정이 필요합니다." };
  }

  const env = getNotionEnv();
  if (!env.ok) {
    return {
      error:
        ".env.local에 NOTION_TOKEN 설정이 필요합니다. (서버 재시작 후 다시 시도)",
    };
  }
  const client = env.client;

  const originalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const today = new Date().toISOString().slice(0, 10);

  let existingResource: Awaited<ReturnType<typeof findResourceByUrl>>;
  try {
    existingResource = await findResourceByUrl(client, originalUrl);
  } catch (e) {
    console.error("[NotionSync] findResourceByUrl failed", e);
    return {
      error:
        "노션 RESOURCE DB 조회에 실패했습니다. 통합이 DB에 연결돼있는지 확인해 주세요.",
    };
  }

  if (existingResource && existingResource.relatedSummaryIds.length > 0) {
    const summaryId = existingResource.relatedSummaryIds[0];
    return {
      ok: true,
      alreadyExists: true,
      summaryUrl: `https://www.notion.so/${summaryId.replace(/-/g, "")}`,
    };
  }

  const context = await getStructuredVideoContext(videoId);
  if ("error" in context) {
    return { error: context.error };
  }

  const analysis = await analyzeVideoForNotion({
    title,
    channel,
    context,
    hint,
  });
  if (!analysis) {
    // GEMINI_API_KEY 누락은 액션 진입부에서 이미 걸러지므로 여기는 생성·파싱 실패
    return {
      error: "AI 섹션 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  let resourcePageId: string;
  let resourceUrl: string;

  if (existingResource) {
    resourcePageId = existingResource.pageId;
    resourceUrl = `https://www.notion.so/${resourcePageId.replace(/-/g, "")}`;
  } else {
    const resourceTitle = buildPageTitle("유튜브 ", title, channel);
    const resourceBody = buildResourceBody({
      context,
      originalUrl,
      channel,
      collectedDate: today,
    });

    const resourceProperties: Record<string, unknown> = {
      이름: { title: [{ type: "text", text: { content: resourceTitle } }] },
      "원본 URL": { url: originalUrl },
      유형: { select: { name: "영상" } },
      소스: { select: { name: "유튜브" } },
      카테고리: { select: { name: analysis.category } },
      우선순위:
        hint?.priority != null
          ? { select: { name: priorityLabel(hint.priority) } }
          : { select: { name: "📌참고" } },
      상태: { status: { name: "처리중" } },
      수집일: { date: { start: today } },
      "저자/출처명": channel
        ? { rich_text: [{ type: "text", text: { content: channel } }] }
        : { rich_text: [] },
      태그: {
        multi_select: analysis.tags.map((t) => ({ name: t })),
      },
    };
    if (durationMinutes != null && Number.isFinite(durationMinutes)) {
      resourceProperties["분량(분)"] = { number: Math.round(durationMinutes) };
    }

    try {
      const resourcePage = await client.pages.create({
        parent: { data_source_id: NOTION_RESOURCE_DS_ID },
        properties:
          resourceProperties as unknown as Parameters<typeof client.pages.create>[0]["properties"],
        children:
          resourceBody as unknown as Parameters<typeof client.pages.create>[0]["children"],
      });
      resourcePageId = resourcePage.id;
      resourceUrl =
        "url" in resourcePage && typeof resourcePage.url === "string"
          ? resourcePage.url
          : `https://www.notion.so/${resourcePageId.replace(/-/g, "")}`;
    } catch (e) {
      console.error("[NotionSync] RESOURCE create failed", e);
      return {
        error:
          "노션 RESOURCE 페이지 생성에 실패했습니다. 통합 권한·스키마 일치 여부를 확인해 주세요.",
      };
    }
  }

  const summaryTitle = buildPageTitle("", title, channel);
  const summaryProperties: Record<string, unknown> = {
    이름: { title: [{ type: "text", text: { content: summaryTitle } }] },
    유형: { select: { name: "영상노트" } },
    카테고리: { select: { name: analysis.category } },
    상태: { status: { name: "초안" } },
    "핵심 인사이트": {
      rich_text: [{ type: "text", text: { content: analysis.headline } }],
    },
    "관련 RESOURCE 1": { relation: [{ id: resourcePageId }] },
    태그: { multi_select: analysis.tags.map((t) => ({ name: t })) },
  };

  const summaryBody = buildSummaryBody({
    analysis,
    hint,
    resourceUrl,
  });

  try {
    const summaryPage = await client.pages.create({
      parent: { data_source_id: NOTION_SUMMARY_DS_ID },
      properties:
        summaryProperties as unknown as Parameters<typeof client.pages.create>[0]["properties"],
      children:
        summaryBody as unknown as Parameters<typeof client.pages.create>[0]["children"],
    });
    const summaryUrl =
      "url" in summaryPage && typeof summaryPage.url === "string"
        ? summaryPage.url
        : `https://www.notion.so/${summaryPage.id.replace(/-/g, "")}`;
    return {
      ok: true,
      resourceUrl,
      summaryUrl,
      reused: !!existingResource,
    };
  } catch (e) {
    console.error("[NotionSync] SUMMARY create failed", e);
    return {
      error:
        "노션 SUMMARY 페이지 생성에 실패했습니다. RESOURCE는 생성됐을 수 있으니 확인해 주세요.",
    };
  }
}

function priorityLabel(priority: number): string {
  if (priority === 1) return "🔥핵심";
  if (priority === 2) return "⚡활용";
  return "📌참고";
}
