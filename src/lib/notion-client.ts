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
