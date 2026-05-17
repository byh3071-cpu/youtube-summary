import { NextResponse } from "next/server";
import {
  getNotionEnv,
  NOTION_RESOURCE_DS_ID,
  NOTION_SUMMARY_DS_ID,
} from "@/lib/notion-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getNotionEnv();
  if (!env.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: "NOTION_TOKEN 환경변수가 없습니다. .env.local 확인 후 dev 서버를 재시작하세요.",
      },
      { status: 503 },
    );
  }

  const result: Record<string, unknown> = { ok: true };

  try {
    const resource = await env.client.dataSources.retrieve({
      data_source_id: NOTION_RESOURCE_DS_ID,
    });
    result.resource = {
      ok: true,
      id: resource.id,
      title:
        "title" in resource && Array.isArray(resource.title)
          ? resource.title.map((t) => ("plain_text" in t ? t.plain_text : "")).join("")
          : null,
    };
  } catch (e) {
    result.ok = false;
    result.resource = {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "RESOURCE DS 접근 실패. 통합을 RESOURCE DB에 연결했는지 확인하세요.",
    };
  }

  try {
    const summary = await env.client.dataSources.retrieve({
      data_source_id: NOTION_SUMMARY_DS_ID,
    });
    result.summary = {
      ok: true,
      id: summary.id,
      title:
        "title" in summary && Array.isArray(summary.title)
          ? summary.title.map((t) => ("plain_text" in t ? t.plain_text : "")).join("")
          : null,
    };
  } catch (e) {
    result.ok = false;
    result.summary = {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "SUMMARY DS 접근 실패. 통합을 SUMMARY DB에 연결했는지 확인하세요.",
    };
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
