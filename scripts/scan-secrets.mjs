import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const scanHistory = process.argv.includes("--history");
const MAX_FILE_SIZE = 1024 * 1024;
const SKIP_FILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const SKIP_EXTENSIONS = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const secretPatterns = [
  ["Google API key", /\bAIza[A-Za-z0-9_-]{20,}\b/g],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ["Stripe secret", /\b(?:sk_live|sk_test|rk_live|rk_test|whsec)_[A-Za-z0-9_-]+\b/g],
  ["AWS access key", /\bAKIA[A-Z0-9]{16}\b/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g],
];

const genericAssignment =
  /\b(api[_-]?key|secret|token|password|authorization)\b\s*[:=]\s*["']([^"'\r\n]{16,})["']/gi;

function isPlaceholder(value) {
  return [
    /^<.*>$/,
    /your[_-]/i,
    /example/i,
    /placeholder/i,
    /replace[_-]?me/i,
    /process\.env/i,
    /os\.environ/i,
    /^\*+$/,
  ].some((pattern) => pattern.test(value));
}

function findSecrets(text, location) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const [type, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        findings.push({ type, location, line: index + 1 });
      }
    }

    genericAssignment.lastIndex = 0;
    for (const match of line.matchAll(genericAssignment)) {
      if (!isPlaceholder(match[2])) {
        findings.push({
          type: `Generic ${match[1]}`,
          location,
          line: index + 1,
        });
      }
    }
  }

  return findings;
}

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git ls-files failed");
  }
  return result.stdout.split("\0").filter(Boolean);
}

function scanWorkingTree() {
  const findings = [];
  let scanned = 0;

  for (const file of trackedFiles()) {
    if (SKIP_FILES.has(file) || SKIP_EXTENSIONS.has(extname(file).toLowerCase())) continue;

    let stats;
    try {
      stats = statSync(file);
    } catch {
      continue;
    }
    if (!stats.isFile() || stats.size > MAX_FILE_SIZE) continue;

    const buffer = readFileSync(file);
    if (buffer.includes(0)) continue;

    scanned += 1;
    findings.push(...findSecrets(buffer.toString("utf8"), file));
  }

  return { findings, scanned };
}

function scanGitHistory() {
  const result = spawnSync("git", ["log", "--all", "-p", "--no-ext-diff", "--no-textconv", "--unified=0"], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git history scan failed");
  }

  const findings = [];
  let commit = "unknown";
  let file = "unknown";
  const seen = new Set();

  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.startsWith("commit ")) {
      commit = line.slice(7).trim();
      continue;
    }
    if (line.startsWith("+++ b/")) {
      file = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;

    for (const finding of findSecrets(line.slice(1), `${commit.slice(0, 12)}:${file}`)) {
      const key = `${finding.type}:${finding.location}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ ...finding, line: null });
    }
  }

  return { findings, scanned: null };
}

function printResult(result) {
  if (result.findings.length === 0) {
    const suffix = result.scanned === null ? "Git history" : `${result.scanned} repository files`;
    console.log(`Secret scan PASS (${suffix})`);
    return;
  }

  console.error(`Secret scan FAIL (${result.findings.length} finding(s))`);
  for (const finding of result.findings) {
    const line = finding.line ? `:${finding.line}` : "";
    console.error(`- ${finding.type}: ${finding.location}${line}`);
  }
  console.error("Secret values are intentionally not printed.");
  process.exitCode = 1;
}

try {
  printResult(scanHistory ? scanGitHistory() : scanWorkingTree());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
