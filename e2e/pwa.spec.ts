import { test, expect } from "@playwright/test";

function pngSize(buffer: Buffer): string {
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

test.describe("pwa", () => {
  test("manifest responds and icons match declared sizes", async ({ request }) => {
    const res = await request.get("/app.webmanifest");
    expect(res.status()).toBe(200);

    const manifest = (await res.json()) as {
      orientation?: string;
      icons: { src: string; sizes: string; type: string }[];
    };

    // 데스크톱 PWA에서 세로 고정이 다시 생기면 안 된다.
    expect(manifest.orientation).toBeUndefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    for (const icon of manifest.icons) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.status(), `icon ${icon.src} should be 200`).toBe(200);
      const body = await iconRes.body();
      expect(pngSize(body), `icon ${icon.src} declared/actual size`).toBe(icon.sizes);
    }
  });

  test("sw.js and offline fallback respond 200", async ({ request }) => {
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    const offline = await request.get("/offline.html");
    expect(offline.status()).toBe(200);
  });

  test("service worker never caches dynamic HTML, API, or RSC", async ({ browser }) => {
    // 캐시 상태에 의존하지 않도록 새 context 사용.
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    // SW가 페이지를 제어하는 상태에서 요청이 fetch 핸들러를 거치도록 재방문.
    await page.reload();
    await page.waitForTimeout(1000);

    const entries = await page.evaluate(async () => {
      const names = await caches.keys();
      const paths: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const url = new URL(req.url);
          paths.push(url.pathname + url.search);
        }
      }
      return paths;
    });

    // 동적 HTML은 어떤 경로도 캐시되면 안 된다.
    for (const path of ["/", "/login", "/pricing", "/landing"]) {
      expect(entries, `dynamic HTML ${path} must not be cached`).not.toContain(path);
    }
    expect(entries.filter((p) => p.startsWith("/api/"))).toHaveLength(0);
    expect(entries.filter((p) => p.startsWith("/auth/"))).toHaveLength(0);
    expect(entries.filter((p) => p.includes("_rsc"))).toHaveLength(0);

    // 오프라인 fallback은 precache 되어 있어야 한다.
    expect(entries).toContain("/offline.html");

    await context.close();
  });
});
