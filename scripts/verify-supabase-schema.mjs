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

if (failed) {
  process.exit(1);
}

console.log("Supabase schema verification passed");
