import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const REQUIRED_TABLES = [
  "user_plan",
  "usage_daily",
  "custom_sources",
  "bookmarks",
  "playlists",
  "teams",
  "team_members",
  "team_invites",
] as const;

function hasValue(value: string | undefined, placeholder: string): boolean {
  return !!value && value.trim() !== "" && value.trim() !== placeholder;
}

function canViewOpsStatus(request: NextRequest): boolean {
  const secret = process.env.OPS_STATUS_SECRET?.trim();
  if (process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;
  return request.headers.get("x-ops-status-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!canViewOpsStatus(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const env = {
    youtube: hasValue(process.env.YOUTUBE_API_KEY, "your_youtube_api_key_here"),
    gemini: hasValue(process.env.GEMINI_API_KEY, "your_gemini_api_key_here"),
    supabaseUrl: hasValue(
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
      "your_supabase_project_url",
    ),
    supabaseServiceRole: hasValue(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "your_supabase_service_role_key",
    ),
    supabaseAnon: hasValue(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "your_supabase_anon_key",
    ),
    stripe: !!(
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRO_PRICE_ID
    ),
    siteUrl: hasValue(process.env.NEXT_PUBLIC_SITE_URL, "https://your-domain.com"),
  };

  const supabase = getServerSupabaseClient();
  const tables: Record<string, "ok" | string> = {};

  if (!supabase) {
    for (const table of REQUIRED_TABLES) {
      tables[table] = "supabase_not_configured";
    }
  } else {
    for (const table of REQUIRED_TABLES) {
      const { error } = await supabase.from(table).select("*").limit(1);
      tables[table] = error ? error.message : "ok";
    }
  }

  const ok =
    env.youtube &&
    env.gemini &&
    env.supabaseUrl &&
    env.supabaseServiceRole &&
    Object.values(tables).every((status) => status === "ok");

  return NextResponse.json({
    ok,
    checkedAt: new Date().toISOString(),
    env,
    tables,
  });
}
