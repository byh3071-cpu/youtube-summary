import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import type { Database } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json([]);
  }
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json([]);
  }
  const { data, error } = await supabase
    .from("custom_sources")
    .select("source_id, name, category, avatar_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[GET /api/custom-sources]", error.message);
    return Response.json([]);
  }
  const rows = (data ?? []) as { source_id: string; name: string; category: string; avatar_url: string | null }[];
  const list = rows.map((row) => ({
    id: row.source_id,
    name: row.name,
    type: "YouTube" as const,
    category: row.category || "기타",
    avatarUrl: row.avatar_url ?? undefined,
  }));
  return Response.json(list);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ ok: true });
  }
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json({ ok: true });
  }
  let body: { sourceId?: string; name?: string; category?: string; avatarUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { sourceId, name, category, avatarUrl } = body;
  if (!sourceId || !name) {
    return Response.json({ error: "sourceId and name required" }, { status: 400 });
  }
  const row: Database["public"]["Tables"]["custom_sources"]["Insert"] = {
    user_id: user.id,
    source_id: sourceId,
    name,
    category: category ?? "기타",
    avatar_url: avatarUrl ?? null,
  };
  const { error } = await supabase.from("custom_sources").insert(row as never);
  if (error) {
    if (error.code === "23505") {
      return Response.json({ ok: true });
    }
    console.error("[POST /api/custom-sources]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ ok: true });
  }
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json({ ok: true });
  }
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");
  if (!sourceId) {
    return Response.json({ error: "sourceId required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("custom_sources")
    .delete()
    .eq("user_id", user.id)
    .eq("source_id", sourceId);
  if (error) {
    console.error("[DELETE /api/custom-sources]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
