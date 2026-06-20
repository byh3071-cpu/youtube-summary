"use server";

import { cookies } from "next/headers";
import {
  getNotionEnv,
  findResourceByUrl,
  NOTION_RESOURCE_DS_ID,
  NOTION_SUMMARY_DS_ID,
  graphWriteEnabled,
  upsertPersonByName,
  tripleExists,
  createTriple,
  upsertConceptByName,
} from "@/lib/notion-client";
import { getStructuredVideoContext } from "@/lib/video-transcript";
import {
  analyzeVideoForNotion,
  type BriefingHint,
} from "@/lib/notion-section-analyzer";
import { buildResourceBody, buildSummaryBody } from "@/lib/notion-content";
import {
  getContentStatesAction,
  setContentStateAction,
} from "@/app/actions/content-state";
import { getPlanForUser } from "@/lib/plan";
import { takeToken } from "@/lib/rate-limit";

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
  contentId?: string;
  requireReviewed?: boolean;
}): Promise<NotionSyncResult> {
  const { videoId, title, channel, durationMinutes, hint, contentId, requireReviewed } =
    args;
  if (!videoId || !title) {
    return { error: "videoId와 title이 필요합니다." };
  }

  // 권한: 공유 Notion 토큰은 운영자(owner) 전용이다. 사용자별 Notion OAuth가
  // 도입되기 전까지 비owner·비로그인 호출은 거절해 운영자 DB 오염·비용을 막는다.
  const cookieStore = await cookies();
  const plan = await getPlanForUser(cookieStore);
  if (plan !== "owner") {
    return { error: "노션 정리는 운영자 계정에서만 사용할 수 있습니다." };
  }

  // ③ reviewed 게이트: contentId + requireReviewed면, 콘텐츠가 'reviewed'일 때만 승급 허용
  //   (스펙 §14.1 — 검토 통과분만 요한 브레인으로). 끄면(기본) 기존 수동 동기화 그대로.
  if (requireReviewed && contentId) {
    const states = await getContentStatesAction([contentId]);
    if (states[contentId]?.state !== "reviewed") {
      return {
        error: "검토 완료('reviewed') 상태에서만 요한 브레인으로 보낼 수 있습니다.",
      };
    }
  }

  // 레이트리밋: 자동/연타 호출로 Gemini·Notion 비용이 폭주하지 않게 막는다.
  const rl = takeToken("notion-sync", 10, 60_000);
  if (!rl.ok) {
    return {
      error: `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해 주세요.`,
    };
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

  // 인물 그래프 쓰기 (NOTION_WRITE_GRAPH=1 일 때만). 이름 일치 재사용, 없으면 생성.
  const personIds: string[] = [];
  if (graphWriteEnabled() && analysis.people.length > 0) {
    for (const person of analysis.people) {
      try {
        const id = await upsertPersonByName(client, person.name, person.role);
        if (id) personIds.push(id);
      } catch (e) {
        console.error("[NotionSync] person upsert failed", e);
      }
    }
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
    if (personIds.length > 0) {
      resourceProperties["관련 인물"] = {
        relation: personIds.map((id) => ({ id })),
      };
    }
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
  if (personIds.length > 0) {
    summaryProperties["관련 인물"] = {
      relation: personIds.map((id) => ({ id })),
    };
  }

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

    // 트리플맵 쓰기 (NOTION_WRITE_GRAPH=1 일 때만). Subject+Relation 중복은 스킵.
    if (graphWriteEnabled() && analysis.triples.length > 0) {
      for (const triple of analysis.triples) {
        try {
          if (!(await tripleExists(client, triple.subject, triple.relation))) {
            await createTriple(client, triple, summaryPage.id);
          }
        } catch (e) {
          console.error("[NotionSync] triple write failed", e);
        }
      }
    }

    // 개념 → AI 사전 쓰기 (NOTION_WRITE_GRAPH=1 일 때만). 상태=미학습(검증 전 후보), 이름 중복은 스킵.
    if (graphWriteEnabled() && analysis.concepts.length > 0) {
      for (const concept of analysis.concepts) {
        try {
          await upsertConceptByName(client, concept, originalUrl);
        } catch (e) {
          console.error("[NotionSync] concept upsert failed", e);
        }
      }
    }

    // ③ 사후: 콘텐츠 상태를 exported로 전이 + notion_page_id 저장 (best-effort).
    //   canTransition상 'reviewed'에서만 성공 — 검토 안 된 콘텐츠는 조용히 스킵된다.
    if (contentId) {
      try {
        await setContentStateAction({
          contentId,
          nextState: "exported",
          notionPageId: summaryPage.id,
        });
      } catch (e) {
        console.error("[NotionSync] content-state exported 전이 실패", e);
      }
    }

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
