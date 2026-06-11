import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3020";
const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(process.cwd(), "artifacts", `ux-audit-${stamp}`);

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--disable-dev-shm-usage", "--no-first-run", "--disable-default-apps"],
});

const requestedProfile = process.env.AUDIT_PROFILE;
const profiles = [
  {
    name: "desktop",
    options: {
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
    },
  },
  {
    name: "mobile",
    options: {
      viewport: { width: 393, height: 852 },
      screen: { width: 393, height: 852 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      colorScheme: "light",
    },
  },
].filter((profile) => !requestedProfile || profile.name === requestedProfile);

const defaultRoutes = [
  "/",
  "/trends",
  "/landing",
  "/login",
  "/pricing",
  "/bookmarks",
  "/playlists",
  "/teams",
  "/profile",
  "/privacy",
  "/terms",
];
const routes = process.env.AUDIT_ROUTES
  ? process.env.AUDIT_ROUTES.split(",").map((route) => route.trim()).filter(Boolean)
  : defaultRoutes;
const screenshotRoutes = new Set([
  "/",
  "/trends",
  "/landing",
  "/login",
  "/pricing",
  "/bookmarks",
  "/playlists",
]);
const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  profiles: {},
  pwa: null,
};

function cleanName(text) {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const buttons = [...document.querySelectorAll("button")].filter(visible);
    const smallButtons = buttons
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          name: (
            el.getAttribute("aria-label") ||
            el.textContent ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.width < 44 || item.height < 44);
    const brokenImages = [...document.images]
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src);

    return {
      title: document.title,
      lang: document.documentElement.lang,
      headings: [...document.querySelectorAll("h1,h2")]
        .filter(visible)
        .map((el) => el.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12),
      mainVisible: visible(document.querySelector("#main")),
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      brokenImages,
      smallButtons: smallButtons.slice(0, 30),
      visibleButtonCount: buttons.length,
      bodyText: (document.body.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 700),
    };
  });
}

for (const profile of profiles) {
  const context = await browser.newContext({
    ...profile.options,
    baseURL,
    locale: "ko-KR",
    serviceWorkers: process.env.AUDIT_BLOCK_SW === "1" ? "block" : "allow",
  });
  const page = await context.newPage();
  const events = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      events.consoleErrors.push(cleanName(message.text()));
    }
  });
  page.on("pageerror", (error) => {
    events.pageErrors.push(cleanName(error.message));
  });
  page.on("requestfailed", (request) => {
    events.failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || "",
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseURL)) {
      events.badResponses.push({
        status: response.status(),
        url: response.url(),
      });
    }
  });

  const result = { routes: {}, interactions: {}, events };

  for (const route of routes) {
    try {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page.waitForTimeout(1_200);
      result.routes[route] = {
        status: response?.status() ?? null,
        finalURL: page.url(),
        ...(await inspectPage(page)),
      };

      if (screenshotRoutes.has(route)) {
        const slug =
          route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
        await page.screenshot({
          path: path.join(outDir, `${profile.name}-${slug}.png`),
          fullPage: true,
        });
      }
    } catch (error) {
      result.routes[route] = {
        error: cleanName(error.message),
        finalURL: page.url(),
      };
    }
  }

  await page.goto("/", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(1_500);

  if (profile.name === "desktop") {
    result.interactions.sidebarVisible = await page
      .locator("aside")
      .first()
      .isVisible()
      .catch(() => false);

    const filterOpen = page
      .getByRole("button", { name: "필터 패널 열기" })
      .first();
    if (await filterOpen.isVisible().catch(() => false)) {
      await filterOpen.click();
      result.interactions.filterOpened = await page
        .getByText("키워드 추가", { exact: true })
        .isVisible()
        .catch(() => false);
      const addKeyword = page.getByText("키워드 추가", { exact: true });
      if (await addKeyword.isVisible().catch(() => false)) {
        await addKeyword.click();
        await page.getByLabel("관심 키워드 입력").fill("AI");
        await page.getByRole("button", { name: "저장" }).click();
        result.interactions.keywordAdded = await page
          .getByText("# AI", { exact: false })
          .isVisible()
          .catch(() => false);
        const removeKeyword = page.getByRole("button", {
          name: "AI 필터 제거",
        });
        if (await removeKeyword.isVisible().catch(() => false)) {
          await removeKeyword.click();
        }
      }
    }

    const addChannel = page
      .getByRole("button", { name: /채널 추가/ })
      .first();
    if (await addChannel.isVisible().catch(() => false)) {
      await addChannel.click();
      result.interactions.addChannelDialog = await page
        .getByRole("dialog", { name: /YouTube 채널 추가/ })
        .isVisible()
        .catch(() => false);
      const add = page.getByRole("button", { name: "추가", exact: true });
      if (await add.isVisible().catch(() => false)) {
        await add.click();
        result.interactions.addChannelValidation = await page
          .getByText("채널 URL 또는 ID를 입력해 주세요.")
          .isVisible()
          .catch(() => false);
      }
      await page
        .getByRole("button", { name: "닫기" })
        .click()
        .catch(() => {});
    }
  } else {
    const menu = page.getByRole("button", { name: "메뉴 열기" });
    result.interactions.mobileHeaderVisible = await menu
      .isVisible()
      .catch(() => false);
    if (result.interactions.mobileHeaderVisible) {
      await menu.click();
      await page.waitForTimeout(300);
      result.interactions.drawerOpened =
        (await page.locator('[role="dialog"]:visible').count()) > 0;
      result.interactions.bodyOverflowWhileDrawer = await page.evaluate(
        () => getComputedStyle(document.body).overflow,
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      result.interactions.drawerClosedByEscape = !(await page
        .getByRole("dialog", { name: "메뉴" })
        .isVisible()
        .catch(() => false));
    }
  }

  const qna = page.getByRole("button", { name: "피드 Q&A 열기" });
  if (await qna.isVisible().catch(() => false)) {
    await qna.click();
    await page.waitForTimeout(300);
    result.interactions.qnaOpened =
      (await page.locator('[role="dialog"]:visible').count()) > 0;
    await page.screenshot({
      path: path.join(outDir, `${profile.name}-qna-open.png`),
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "패널 닫기" })
      .click()
      .catch(() => {});
  }

  const radioAdd = page
    .getByRole("button", { name: "라디오에 추가" })
    .first();
  result.interactions.radioAddAvailable = await radioAdd
    .isVisible()
    .catch(() => false);
  if (result.interactions.radioAddAvailable) {
    await radioAdd.click();
    await page.waitForTimeout(800);
    result.interactions.radioPlayerVisible = await page
      .getByRole("region", { name: "라디오 플레이어" })
      .isVisible()
      .catch(() => false);
    await page.screenshot({
      path: path.join(outDir, `${profile.name}-radio.png`),
      fullPage: true,
    });
  }

  result.interactions.themeToggleVisible = await page
    .getByRole("button", { name: "테마 전환" })
    .isVisible()
    .catch(() => false);
  result.interactions.loginButtonVisible = await page
    .getByRole("button", { name: /Google로 로그인/ })
    .first()
    .isVisible()
    .catch(() => false);
  result.interactions.homeAfter = await inspectPage(page);

  if (profile.name === "desktop") {
    try {
      const cdp = await context.newCDPSession(page);
      const manifest = await cdp.send("Page.getAppManifest");
      const serviceWorker = await page.evaluate(async () => {
        const link =
          document
            .querySelector('link[rel="manifest"]')
            ?.getAttribute("href") ?? null;
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(() => resolve(null), 8_000)),
        ]);
        return {
          link,
          supported: "serviceWorker" in navigator,
          active: !!registration?.active,
          controller: !!navigator.serviceWorker.controller,
          cacheKeys: "caches" in window ? await caches.keys() : [],
        };
      });
      report.pwa = { manifest, serviceWorker };
    } catch (error) {
      report.pwa = { error: cleanName(error.message) };
    }
  }

  report.profiles[profile.name] = result;
  await context.close();
}

await browser.close();

const reportPath = path.join(outDir, "report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      outDir,
      reportPath,
      summary: Object.fromEntries(
        Object.entries(report.profiles).map(([name, profile]) => [
          name,
          {
            routeCount: Object.keys(profile.routes).length,
            consoleErrors: profile.events.consoleErrors.length,
            pageErrors: profile.events.pageErrors.length,
            failedRequests: profile.events.failedRequests.length,
            badResponses: profile.events.badResponses.length,
            interactions: profile.interactions,
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
