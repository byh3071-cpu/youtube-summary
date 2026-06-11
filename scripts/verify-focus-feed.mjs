import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const release = process.argv.includes("--release");

function hasSupabaseVerificationEnv() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function run(label, args) {
  console.log(`\n[verify] ${label}`);
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env: release ? { ...process.env, CI: "true" } : process.env,
    shell: isWindows,
    stdio: "inherit",
  });
  return result.status ?? 1;
}

const gates = [
  ["VHK rules", ["run", "vhk", "--", "check"]],
  ["Secret scan", ["run", "security:secrets"]],
  ["ESLint", ["run", "lint"]],
  ["TypeScript", ["exec", "--", "tsc", "--noEmit", "--incremental", "false"]],
  ["Unit tests", ["run", "test:unit"]],
  ["Production build", ["run", "build"]],
];

if (release) {
  gates.push(
    ["Runtime smoke test", ["test"]],
    ["Playwright E2E", ["run", "test:e2e"]],
    ["npm audit high+", ["audit", "--audit-level=high"]],
    ["Git history secret scan", ["run", "security:history"]],
  );

  if (hasSupabaseVerificationEnv()) {
    gates.push(["Supabase schema", ["run", "verify:supabase"]]);
  } else {
    console.log("\n[verify] Supabase schema skipped: required server credentials are not present.");
  }
}

const failures = [];
for (const [label, args] of gates) {
  const status = run(label, args);
  if (status !== 0) failures.push(`${label} (exit ${status})`);
}

const policyStatus = run("VHK incident policy", ["run", "vhk:policy"]);
if (policyStatus !== 0) failures.push(`VHK incident policy (exit ${policyStatus})`);

if (failures.length > 0) {
  console.error("\nFocus Feed verification FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nFocus Feed verification PASS (${release ? "release" : "default"})`);
