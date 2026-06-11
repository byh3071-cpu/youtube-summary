import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const ROOT = process.cwd();
const DEFAULT_REPO = "byh3071-cpu/vhk";
const ISSUE_REPO = process.env.VHK_GITHUB_REPO || DEFAULT_REPO;
const INCIDENT_DIR = resolveIncidentDir();
const REGISTRY_PATH = join(ROOT, "docs", "vhk-issues.json");
const MAX_OUTPUT = 64 * 1024;

function resolveIncidentDir() {
  const configured = process.env.VHK_INCIDENT_DIR;
  if (!configured) return join(ROOT, ".vhk", "incidents");
  return isAbsolute(configured) ? configured : resolve(ROOT, configured);
}

function ensureIncidentDir() {
  mkdirSync(INCIDENT_DIR, { recursive: true });
}

function redact(value) {
  let output = String(value ?? "");
  const home = homedir();

  if (home) {
    output = output.replaceAll(home, "<HOME>");
    output = output.replaceAll(home.replaceAll("\\", "/"), "<HOME>");
  }

  output = output
    .replace(
      /((?:[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|AUTH)[A-Z0-9_]*)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1<REDACTED>",
    )
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, "<REDACTED_GITHUB_TOKEN>")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "<REDACTED_GITHUB_TOKEN>")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "<REDACTED_GOOGLE_KEY>")
    .replace(/\b(?:sk_live|sk_test|rk_live|rk_test|whsec)_[A-Za-z0-9_-]+\b/g, "<REDACTED_STRIPE_SECRET>")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "<REDACTED_JWT>");

  return output;
}

function sanitizeCommand(args) {
  return args.map((arg, index) => {
    const previous = args[index - 1] ?? "";
    if (/token|secret|password|key|auth/i.test(previous)) return "<REDACTED>";
    return redact(arg);
  });
}

function timestampId(seed) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const hash = createHash("sha256").update(`${timestamp}:${seed}`).digest("hex").slice(0, 8);
  return `${timestamp}-${hash}`;
}

function incidentPath(id) {
  return join(INCIDENT_DIR, `${id}.json`);
}

function writeIncident(incident) {
  ensureIncidentDir();
  incident.updatedAt = new Date().toISOString();
  writeFileSync(incidentPath(incident.id), `${JSON.stringify(incident, null, 2)}\n`, "utf8");
}

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return { schemaVersion: 1, issues: [] };
  }
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  if (!Array.isArray(registry.issues)) {
    throw new Error(`${REGISTRY_PATH}의 issues가 배열이 아닙니다.`);
  }
  return registry;
}

function writeRegistry(registry) {
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function upsertRegistryIssue(incident) {
  const registry = readRegistry();
  const entry = {
    id: incident.id,
    discoveredAt: incident.createdAt,
    vhkVersion: incident.vhkVersion ?? "unknown",
    title: incident.title || "VHK issue",
    status: incident.issueUrl ? "reported" : "pending",
    issueUrl: incident.issueUrl ?? null,
  };
  const index = registry.issues.findIndex((issue) => issue.id === incident.id);
  if (index === -1) registry.issues.push(entry);
  else registry.issues[index] = { ...registry.issues[index], ...entry };
  writeRegistry(registry);
}

function removeRegistryIssue(id) {
  const registry = readRegistry();
  const next = registry.issues.filter((issue) => issue.id !== id);
  if (next.length === registry.issues.length) return;
  registry.issues = next;
  writeRegistry(registry);
}

function readIncident(id) {
  const path = incidentPath(id);
  if (!existsSync(path)) {
    throw new Error(`VHK incident를 찾을 수 없습니다: ${id}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function readIncidents() {
  if (!existsSync(INCIDENT_DIR)) return [];
  return readdirSync(INCIDENT_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(readFileSync(join(INCIDENT_DIR, file), "utf8"));
      } catch {
        return {
          id: file.replace(/\.json$/, ""),
          status: "invalid",
          classification: null,
        };
      }
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function parseOptions(args) {
  const options = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { options, positional };
}

function vhkMetadata() {
  const packagePath = join(ROOT, "node_modules", "@byh3071", "vhk", "package.json");
  if (!existsSync(packagePath)) {
    throw new Error("@byh3071/vhk가 설치되지 않았습니다. npm install을 먼저 실행하세요.");
  }

  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  return {
    entry: join(ROOT, "node_modules", "@byh3071", "vhk", packageJson.bin.vhk),
    version: packageJson.version,
  };
}

function looksLikeToolCrash(output, error) {
  if (error) return true;
  return [
    /(?:TypeError|ReferenceError|SyntaxError|RangeError):/,
    /ERR_MODULE_NOT_FOUND/,
    /UnhandledPromiseRejection/i,
    /node:internal\//,
    /node_modules[\\/]@byh3071[\\/]vhk[\\/].+\bat\b/i,
  ].some((pattern) => pattern.test(output));
}

function isExpectedProjectGate(args) {
  const command = args.join(" ").toLowerCase();
  return [
    "verify",
    "secure scan",
    "check",
    "harness",
    "audit",
    "env-check",
    "testmap",
    "preflight",
    "review",
    "mission check",
    "goal check",
    "goal done",
  ].some((gate) => command === gate || command.startsWith(`${gate} `));
}

function recordRunFailure(args, result, version) {
  const output = redact(`${result.stdout ?? ""}\n${result.stderr ?? ""}`).trim().slice(-MAX_OUTPUT);
  const toolCrash = looksLikeToolCrash(output, result.error);
  const expectedProjectFailure = isExpectedProjectGate(args) && !toolCrash;
  const id = timestampId(`${args.join(" ")}:${result.status}:${output}`);
  const incident = {
    schemaVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "vhk-guard",
    vhkVersion: version,
    command: sanitizeCommand(args),
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    classification: expectedProjectFailure ? "project" : null,
    status: expectedProjectFailure ? "project-failure" : "untriaged",
    title: expectedProjectFailure ? "Project gate failed while running VHK" : "Possible VHK tool failure",
    expected: "",
    actual: "",
    reproduction: "",
    note: expectedProjectFailure
      ? "Known project gate returned non-zero. Reclassify as VHK if the gate result is incorrect."
      : "Triage is required before work can be declared complete.",
    issueUrl: null,
    output,
  };
  writeIncident(incident);
  if (incident.status === "untriaged") upsertRegistryIssue(incident);
  return incident;
}

function runVhk(args) {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  if (normalizedArgs.length === 0) {
    throw new Error("VHK command가 필요합니다. 예: npm run vhk -- status");
  }

  const { entry, version } = vhkMetadata();
  const result = spawnSync(process.execPath, [entry, ...normalizedArgs], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error || result.status !== 0) {
    const incident = recordRunFailure(normalizedArgs, result, version);
    console.error(`\nVHK incident: ${incident.id}`);
    console.error(`기록: ${incidentPath(incident.id)}`);
    if (incident.status === "untriaged") {
      console.error(`분류: npm run vhk:triage -- ${incident.id} project|vhk`);
    }
    process.exitCode = result.status ?? 1;
  }
}

function recordManualIncident(args) {
  const { options } = parseOptions(args);
  const required = ["title", "command", "expected", "actual", "repro"];
  const missing = required.filter((key) => !options[key]);
  if (missing.length > 0) {
    throw new Error(`필수 옵션 누락: ${missing.map((key) => `--${key}`).join(", ")}`);
  }

  const { version } = vhkMetadata();
  const id = timestampId(`${options.command}:${options.title}`);
  const incident = {
    schemaVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "manual",
    vhkVersion: version,
    command: [redact(options.command)],
    exitCode: null,
    signal: null,
    classification: "vhk",
    status: "vhk-confirmed",
    title: redact(options.title),
    expected: redact(options.expected),
    actual: redact(options.actual),
    reproduction: redact(options.repro),
    note: redact(options.note ?? ""),
    issueUrl: null,
    output: "",
  };
  writeIncident(incident);
  upsertRegistryIssue(incident);
  console.log(`VHK incident 기록: ${incident.id}`);
  console.log(`다음 단계: npm run vhk:report -- ${incident.id}`);
}

function triageIncident(args) {
  const { options, positional } = parseOptions(args);
  const [id, classification] = positional;
  if (!id || !["project", "vhk"].includes(classification)) {
    throw new Error("사용법: npm run vhk:triage -- <incident-id> project|vhk [--note \"...\"]");
  }

  const incident = readIncident(id);
  incident.classification = classification;
  incident.note = redact(options.note ?? incident.note ?? "");

  if (classification === "project") {
    incident.status = "project-failure";
    removeRegistryIssue(id);
  } else {
    incident.status = incident.issueUrl ? "reported" : "vhk-confirmed";
    if (options.title) incident.title = redact(options.title);
    if (options.expected) incident.expected = redact(options.expected);
    if (options.actual) incident.actual = redact(options.actual);
    if (options.repro) incident.reproduction = redact(options.repro);
  }

  writeIncident(incident);
  if (classification === "vhk") upsertRegistryIssue(incident);
  console.log(`VHK incident ${id}: ${classification}로 분류`);
  if (classification === "vhk" && !incident.issueUrl) {
    console.log(`신고 필요: npm run vhk:report -- ${id}`);
  }
}

function issueUrlPattern() {
  const escaped = ISSUE_REPO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https://github\\.com/${escaped}/issues/\\d+(?:$|[?#])`, "i");
}

function linkIncident(args) {
  const [id, url] = args;
  if (!id || !url) {
    throw new Error("사용법: npm run vhk:link -- <incident-id> <issue-url>");
  }
  if (!issueUrlPattern().test(url)) {
    throw new Error(`VHK upstream 이슈 URL이 아닙니다: ${url}`);
  }

  const incident = readIncident(id);
  incident.classification = "vhk";
  incident.status = "reported";
  incident.issueUrl = url;
  writeIncident(incident);
  upsertRegistryIssue(incident);
  console.log(`VHK incident ${id} -> ${url}`);
}

function buildIssueBody(incident) {
  const command = incident.command?.join(" ") || "(unknown)";
  const output = incident.output || "(captured output 없음)";
  return redact(`## Environment

- Focus Feed integration
- VHK: ${incident.vhkVersion ?? "unknown"}
- Node: ${process.version}
- OS: ${process.platform} ${process.arch}

## Command

\`\`\`text
${command}
\`\`\`

## Expected

${incident.expected || "(작성 필요)"}

## Actual

${incident.actual || incident.note || "(작성 필요)"}

## Reproduction

${incident.reproduction || "(작성 필요)"}

## Sanitized output

\`\`\`text
${output.slice(-20000)}
\`\`\`

## Reporter policy

This report was generated by Focus Feed's VHK guard. Secrets, tokens, and the user home path were redacted before submission.
`);
}

function writeIssueDraft(incident) {
  ensureIncidentDir();
  const bodyPath = join(INCIDENT_DIR, `${incident.id}-issue-draft.md`);
  writeFileSync(bodyPath, buildIssueBody(incident), "utf8");
  return bodyPath;
}

function draftIncident(args) {
  const [id] = args;
  if (!id) throw new Error("사용법: npm run vhk:draft -- <incident-id>");

  const incident = readIncident(id);
  if (incident.classification !== "vhk") {
    throw new Error("project failure는 VHK upstream draft 대상이 아닙니다.");
  }

  const bodyPath = writeIssueDraft(incident);
  console.log(`VHK issue draft: ${bodyPath}`);
  console.log("외부 게시 전 사용자에게 draft 검토와 명시적 승인을 받아야 합니다.");
}

function reportIncident(args) {
  const { options, positional } = parseOptions(args);
  const [id] = positional;
  if (!id) throw new Error("사용법: npm run vhk:report -- <incident-id>");
  if (!options.approved) {
    throw new Error(
      "외부 GitHub 게시에는 사용자 명시 승인이 필요합니다. 승인 후 --approved를 추가하세요.",
    );
  }

  const incident = readIncident(id);
  if (incident.classification !== "vhk") {
    throw new Error("project failure는 VHK upstream에 신고할 수 없습니다. 먼저 vhk로 분류하세요.");
  }
  if (incident.issueUrl) {
    console.log(`이미 신고됨: ${incident.issueUrl}`);
    return;
  }

  const title = `[Focus Feed] ${incident.title || "VHK issue"}`;
  const bodyPath = writeIssueDraft(incident);

  const auth = spawnSync("gh", ["auth", "status"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (auth.error || auth.status !== 0) {
    console.error(`GitHub CLI 인증이 필요합니다. draft: ${bodyPath}`);
    process.exitCode = 1;
    return;
  }

  const result = spawnSync(
    "gh",
    ["issue", "create", "--repo", ISSUE_REPO, "--title", title, "--body-file", bodyPath],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0) {
    console.error(redact(result.stderr || result.error?.message || "GitHub issue 생성 실패"));
    console.error(`draft: ${bodyPath}`);
    process.exitCode = result.status ?? 1;
    return;
  }

  const issueUrl = result.stdout.trim().match(/https:\/\/github\.com\/[^\s]+\/issues\/\d+/)?.[0];
  if (!issueUrl) {
    console.error(`이슈 URL을 확인할 수 없습니다. 출력: ${redact(result.stdout)}`);
    process.exitCode = 1;
    return;
  }

  incident.status = "reported";
  incident.issueUrl = issueUrl;
  writeIncident(incident);
  upsertRegistryIssue(incident);
  console.log(`VHK upstream 이슈 등록: ${issueUrl}`);
}

function listIncidents() {
  const incidents = readIncidents();
  if (incidents.length === 0) {
    console.log("VHK incident 없음");
    return;
  }

  for (const incident of incidents) {
    console.log(
      `${incident.id}  ${incident.status}  ${incident.classification ?? "untriaged"}  ${incident.issueUrl ?? ""}`,
    );
  }
}

function checkPolicy() {
  const incidents = readIncidents();
  const registry = readRegistry();
  const blocked = incidents.filter((incident) => {
    if (incident.status === "invalid") return true;
    if (!incident.classification) return true;
    if (incident.classification === "vhk") {
      return incident.status !== "reported" || !issueUrlPattern().test(incident.issueUrl ?? "");
    }
    return false;
  });
  const blockedIds = new Set(blocked.map((incident) => incident.id));
  for (const issue of registry.issues) {
    const reported = issue.status === "reported" && issueUrlPattern().test(issue.issueUrl ?? "");
    if (!reported && !blockedIds.has(issue.id)) {
      blocked.push({
        id: issue.id,
        status: issue.status,
        classification: "vhk",
        issueUrl: issue.issueUrl,
      });
    }
  }

  if (blocked.length === 0) {
    console.log(
      `VHK incident policy PASS (local ${incidents.length}건, registry ${registry.issues.length}건 확인)`,
    );
    return;
  }

  console.error("VHK incident policy FAIL");
  for (const incident of blocked) {
    console.error(
      `- ${incident.id}: ${incident.status} / ${incident.classification ?? "untriaged"} / ${incident.issueUrl ?? "issue 없음"}`,
    );
  }
  process.exitCode = 1;
}

function usage() {
  console.log(`Usage:
  node scripts/vhk-guard.mjs run <vhk command...>
  node scripts/vhk-guard.mjs record --title ... --command ... --expected ... --actual ... --repro ...
  node scripts/vhk-guard.mjs triage <id> project|vhk [--note ...]
  node scripts/vhk-guard.mjs draft <id>
  node scripts/vhk-guard.mjs report <id> --approved
  node scripts/vhk-guard.mjs link <id> <issue-url>
  node scripts/vhk-guard.mjs list
  node scripts/vhk-guard.mjs check`);
}

function main() {
  const [action, ...args] = process.argv.slice(2);
  switch (action) {
    case "run":
      runVhk(args);
      break;
    case "record":
      recordManualIncident(args);
      break;
    case "triage":
      triageIncident(args);
      break;
    case "draft":
      draftIncident(args);
      break;
    case "report":
      reportIncident(args);
      break;
    case "link":
      linkIncident(args);
      break;
    case "list":
      listIncidents();
      break;
    case "check":
      checkPolicy();
      break;
    default:
      usage();
      process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
