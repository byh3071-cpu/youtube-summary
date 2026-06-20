import { Client } from "@notionhq/client";

export const NOTION_RESOURCE_DS_ID = "ca4cf904-81b3-40e5-b37e-65c83eb66b9a";
export const NOTION_SUMMARY_DS_ID = "a20db2bd-0c9b-45ac-9ca8-9d53cc794bdd";

export type NotionEnv =
  | { ok: true; client: Client }
  | { ok: false; reason: "missing_token" };

let cachedClient: Client | null = null;

export function getNotionEnv(): NotionEnv {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { ok: false, reason: "missing_token" };
  if (!cachedClient) {
    cachedClient = new Client({ auth: token });
  }
  return { ok: true, client: cachedClient };
}

export type ExistingResource = {
  pageId: string;
  relatedSummaryIds: string[];
};

export async function findResourceByUrl(
  client: Client,
  originalUrl: string,
): Promise<ExistingResource | null> {
  const res = await client.dataSources.query({
    data_source_id: NOTION_RESOURCE_DS_ID,
    filter: {
      property: "원본 URL",
      url: { equals: originalUrl },
    },
    page_size: 1,
  });

  const page = res.results[0];
  if (!page || !("properties" in page)) return null;

  const relProp = (page.properties as Record<string, unknown>)["관련 SUMMARY"];
  const relations =
    relProp && typeof relProp === "object" && "relation" in relProp
      ? ((relProp as { relation: Array<{ id: string }> }).relation ?? [])
      : [];

  return {
    pageId: page.id,
    relatedSummaryIds: relations.map((r) => r.id),
  };
}

export const NOTION_PERSON_DS_ID = "2ce66f84-9b58-421d-a814-ed741fcfaf5e";
export const NOTION_TRIPLE_DS_ID = "99fa489c-4243-4b23-9453-416c15dad231";

/**
 * 인물·트리플 등 "그래프 쓰기"는 기본 비활성이다.
 * 운영자가 NOTION_WRITE_GRAPH=1 로 명시적으로 켤 때만 동작한다(켜기 전엔 기존 동기화 그대로).
 */
export function graphWriteEnabled(): boolean {
  const v = process.env.NOTION_WRITE_GRAPH;
  return v === "1" || v === "true";
}

/**
 * 이름(title)으로 인물을 찾고, 없으면 최소 정보로 생성해 pageId를 돌려준다.
 * 중복 규칙: 정확한 이름 일치 1건이면 재사용, 없으면 새로 생성(동명이인·새 정보 허용).
 */
export async function upsertPersonByName(
  client: Client,
  name: string,
  role?: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const res = await client.dataSources.query({
    data_source_id: NOTION_PERSON_DS_ID,
    filter: { property: "이름", title: { equals: trimmed } },
    page_size: 1,
  });
  const found = res.results[0];
  if (found) return found.id;

  const properties: Record<string, unknown> = {
    이름: { title: [{ type: "text", text: { content: trimmed } }] },
  };
  if (role && role.trim()) {
    properties["역할/직함"] = {
      rich_text: [{ type: "text", text: { content: role.trim() } }],
    };
  }
  const page = await client.pages.create({
    parent: { data_source_id: NOTION_PERSON_DS_ID },
    properties:
      properties as unknown as Parameters<typeof client.pages.create>[0]["properties"],
  });
  return page.id;
}

/** Subject+Relation 동일 트리플이 이미 있으면 true (중복 스킵용). */
export async function tripleExists(
  client: Client,
  subject: string,
  relation: string,
): Promise<boolean> {
  const res = await client.dataSources.query({
    data_source_id: NOTION_TRIPLE_DS_ID,
    filter: {
      and: [
        { property: "Subject", title: { equals: subject } },
        { property: "Relation", rich_text: { equals: relation } },
      ],
    },
    page_size: 1,
  });
  return res.results.length > 0;
}

/** 트리플 1건을 트리플 맵 DB에 생성하고 출처 SUMMARY로 연결한다. */
export async function createTriple(
  client: Client,
  triple: {
    subject: string;
    relation: string;
    object: string;
    domain: string;
    confidence: number;
  },
  summaryPageId: string,
): Promise<void> {
  const properties: Record<string, unknown> = {
    Subject: { title: [{ type: "text", text: { content: triple.subject } }] },
    Relation: {
      rich_text: [{ type: "text", text: { content: triple.relation } }],
    },
    Object: { rich_text: [{ type: "text", text: { content: triple.object } }] },
    도메인: { select: { name: triple.domain } },
    신뢰도: { number: triple.confidence },
    "출처 SUMMARY": { relation: [{ id: summaryPageId }] },
  };
  await client.pages.create({
    parent: { data_source_id: NOTION_TRIPLE_DS_ID },
    properties:
      properties as unknown as Parameters<typeof client.pages.create>[0]["properties"],
  });
}

export const NOTION_AIDICT_DS_ID = "3349740a-b072-809b-8d6f-000b4b8964b3";

/**
 * 개념(용어)을 AI 사전에서 이름으로 찾고, 없으면 생성한다.
 * 상태는 "미학습"으로 기록 — 자동 추출이라 검증 전 후보임을 DB에서 명시한다("검증된 개념만 승급" 규칙 보호).
 * 이미 있으면 중복 생성하지 않고 재사용한다.
 */
export async function upsertConceptByName(
  client: Client,
  name: string,
  refUrl?: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const res = await client.dataSources.query({
    data_source_id: NOTION_AIDICT_DS_ID,
    filter: { property: "이름", title: { equals: trimmed } },
    page_size: 1,
  });
  const found = res.results[0];
  if (found) return found.id;

  const properties: Record<string, unknown> = {
    이름: { title: [{ type: "text", text: { content: trimmed } }] },
    상태: { status: { name: "미학습" } },
  };
  if (refUrl) {
    properties["참고 링크"] = { url: refUrl };
  }
  const page = await client.pages.create({
    parent: { data_source_id: NOTION_AIDICT_DS_ID },
    properties:
      properties as unknown as Parameters<typeof client.pages.create>[0]["properties"],
  });
  return page.id;
}
