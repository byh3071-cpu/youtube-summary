import { defineConfig, devices } from "@playwright/test";

const isCi = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  // dev 서버는 렌더 비용이 커서(트렌드 외부 API 포함) 병렬을 줄여 타임아웃 플레이크 방지
  workers: isCi ? 1 : 2,
  // 무거운 첫 렌더·hydration을 고려한 테스트 타임아웃
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile-.*\.spec\.ts/,
    },
    {
      // 393x851 — 감사 기준(393x852)과 동급. 모바일 전용 스펙 + 공통 스모크만 실행.
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
      testMatch: /(mobile-.*|smoke)\.spec\.ts/,
    },
    // WebKit(iOS Safari) 모바일은 Windows/CI 안정성·비용 문제로 자동화하지 않는다.
    // 실기기 검증은 docs/MOBILE_QA_CHECKLIST.md 수동 항목을 따른다.
  ],
  webServer: isCi
    ? {
        command: "npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: "npm run dev -- --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
