// Playwright E2E 러너 — Windows + Node 24 환경 우회 포함 (2026-06-11 진단).
//
// 1) node 버전 전환 후 남은 Playwright 변환 캐시(V8 code cache)를 재사용하면
//    시작 시점에 0xC0000409로 무출력 크래시한다 → 실행마다 새 PWTEST_CACHE_DIR 지정.
// 2) 일부 환경에서 테스트 완료 후 종료 코드가 네이티브 크래시로 오염될 수 있다
//    → Playwright가 실행 마지막에 기록하는 test-results/.last-run.json(status)을
//      이번 실행에서 갱신됐는지(mtime) 확인해 성패를 판정한다. CI(Linux)는 영향 없음.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const LAST_RUN_FILE = path.join("test-results", ".last-run.json");
const startedAt = Date.now();

// 종료 코드 오염 보정은 진단된 Windows 로컬 환경(node v24 + 네이티브 teardown 크래시)에서만 적용한다.
// CI(Linux)나 그 외 환경에서는 Playwright 종료 코드를 그대로 전달해, 결과 기록 후 발생하는
// 진짜 인프라 실패(teardown·reporter 오류 등)가 녹색으로 위장되지 않게 한다.
const ALLOW_EXIT_CODE_OVERRIDE = process.platform === "win32" && !process.env.CI;

const cacheDir = mkdtempSync(path.join(os.tmpdir(), "pw-transform-"));

const child = spawn(
  process.execPath,
  [path.join("node_modules", "@playwright", "test", "cli.js"), "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, PWTEST_CACHE_DIR: cacheDir, NODE_DISABLE_COMPILE_CACHE: "1" },
  },
);

child.on("close", (code) => {
  if (code === 0) process.exit(0);

  // (Windows 로컬 한정) 종료 코드가 오염돼도 이번 실행이 기록한 결과 파일이 "passed"면 성공 판정.
  if (ALLOW_EXIT_CODE_OVERRIDE) {
    try {
      const stat = statSync(LAST_RUN_FILE);
      if (stat.mtimeMs >= startedAt) {
        const lastRun = JSON.parse(readFileSync(LAST_RUN_FILE, "utf8"));
        if (lastRun.status === "passed") {
          console.warn(
            `[run-e2e] 테스트는 모두 통과했으나 프로세스 종료 코드(${code})가 오염되어 결과 파일로 성공 판정 (Windows 환경 이슈).`,
          );
          process.exit(0);
        }
      }
    } catch {
      // 결과 파일이 없으면 아래에서 실패 처리
    }
  }

  process.exit(code === null ? 1 : Math.min(Math.abs(code), 255) || 1);
});
