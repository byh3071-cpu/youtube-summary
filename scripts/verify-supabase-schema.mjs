import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

const requiredTables = [
  "user_plan",
  "usage_daily",
  "custom_sources",
  "bookmarks",
  "playlists",
  "teams",
  "team_members",
  "team_invites",
];

function isPlaceholder(value) {
  return !value || value.startsWith("your_");
}

if (isPlaceholder(url) || isPlaceholder(serviceKey)) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

let failed = false;

for (const table of requiredTables) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    failed = true;
    console.error(`FAIL ${table}: ${error.message}`);
  } else {
    console.log(`OK   ${table}`);
  }
}

// 팀 테이블 RLS 검증 (009_teams_rls.sql 적용 확인)
// service_role 은 RLS 를 우회하므로 anon 키로 직접 조회를 시도한다.
// RLS 활성 + anon SELECT 정책 없음(team_invites) 또는 멤버십 게이트(teams/team_members)
// 이므로, 비로그인 anon 조회는 데이터가 노출되면 안 된다(0행이어야 안전).
const rlsTeamTables = ["teams", "team_members", "team_invites"];

if (isPlaceholder(anonKey)) {
  console.warn(
    "WARN RLS canary skipped: NEXT_PUBLIC_SUPABASE_ANON_KEY (또는 SUPABASE_ANON_KEY) 미설정.",
  );
  console.warn(
    "     anon 차단 확인을 위해 anon 키를 설정하고 재실행하세요(009_teams_rls.sql).",
  );
} else {
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  for (const table of rlsTeamTables) {
    const { data, error } = await anonClient.from(table).select("*").limit(1);
    if (error) {
      // RLS 거부는 보통 0행으로 나타나지만, 명시적 권한 오류도 차단으로 간주한다.
      console.log(`OK   RLS ${table}: anon 차단(${error.message})`);
    } else if (Array.isArray(data) && data.length === 0) {
      console.log(`OK   RLS ${table}: anon 직접 조회 0행`);
    } else {
      failed = true;
      console.error(
        `FAIL RLS ${table}: anon 키로 ${data?.length ?? "?"}행이 노출됨 — RLS/정책 미적용 의심.`,
      );
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("Supabase schema verification passed");
