import { test, expect } from "@playwright/test";

const accessKey = process.env.LEDGER_TEST_ACCESS_KEY!;
const storageKey = "card-tally.access-key";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
});
async function login(page: import("@playwright/test").Page, remember = true) {
  await page.goto("/");
  await page.getByPlaceholder("粘贴访问密钥").fill(accessKey);
  if (!remember) await page.locator(".remember-device").click();
  await page.getByRole("button", { name: "进入账本" }).click();
  await expect(page.getByRole("heading", { name: "月度总览." })).toBeVisible();
}

test("iOS 安装元数据、图标和 Safari 添加到主屏幕说明", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  const response = await request.get("/manifest.webmanifest");
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/overview");
  expect(manifest.short_name).toBe("卡有数");
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBe(true);
  const size = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/icons/apple-touch-icon.png";
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(size).toEqual([180, 180]);
  await page.getByRole("button", { name: "添加到主屏幕", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("在 Safari 中打开");
  await expect(page.getByRole("dialog")).toContainText("作为 Web App 打开");
});

test("默认记住设备：关闭页面重开直接登录，锁定清除持久化密钥", async ({
  page,
  context,
}) => {
  await login(page);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key) !== null,
      storageKey,
    ),
  ).toBe(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/records");
  await expect(
    reopened.getByRole("heading", { name: "消费明细." }),
  ).toBeVisible();
  await reopened.getByRole("button", { name: "锁定账本" }).click();
  await expect(
    reopened.getByRole("heading", { name: "打开你的账本" }),
  ).toBeVisible();
  expect(
    await reopened.evaluate(
      (key) => [localStorage.getItem(key), sessionStorage.getItem(key)],
      storageKey,
    ),
  ).toEqual([null, null]);
  await reopened.reload();
  await expect(
    reopened.getByRole("heading", { name: "打开你的账本" }),
  ).toBeVisible();
});

test("取消记住设备仅保留标签页会话", async ({ page, context }) => {
  await login(page, false);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "月度总览." })).toBeVisible();
  const fresh = await context.newPage();
  await fresh.goto("/");
  await expect(
    fresh.getByRole("heading", { name: "打开你的账本" }),
  ).toBeVisible();
});

test.describe("认证网络故障", () => {
  // Route interception must run outside service workers to work consistently in WebKit.
  test.use({ serviceWorkers: "block" });
  test("断网重试保留密钥，认证失效清除密钥", async ({ page }) => {
    await login(page);
    await page.route("**/api/session", (route) => route.abort());
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "暂时无法连接账本" }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => !!localStorage.getItem(key), storageKey),
    ).toBe(true);
    await page.unroute("**/api/session");
    await page.getByRole("button", { name: "重新连接", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "月度总览." }),
    ).toBeVisible();
    await page.route("**/api/session", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "密钥已失效" }),
      }),
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "打开你的账本" }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBeNull();
  });
});

test("离线页面不缓存 API 或密钥，恢复网络后可自动登录", async ({
  page,
  context,
}) => {
  await login(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/overview");
  await expect(
    page.getByRole("heading", { name: "暂时无法连接账本" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(192);
  const cacheUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cacheUrls.length).toBeGreaterThan(0);
  expect(
    cacheUrls.every(
      (url) => url === "/offline.html" || url.startsWith("/icons/"),
    ),
  ).toBe(true);
  await context.setOffline(false);
  await page.getByRole("link", { name: "重新连接" }).click();
  await expect(page.getByRole("heading", { name: "月度总览." })).toBeVisible();
});

test("独立窗口隐藏安装引导入口，存储被拒绝时仍可登录", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage denied", "QuotaExceededError");
    };
  });
  await login(page);
  await expect(
    page.getByRole("button", { name: "添加到主屏幕", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("浏览器未允许保存登录状态，本次仍可使用账本。"),
  ).toBeVisible();
});

test("保存的设备密钥可在新的浏览器会话恢复，另一标签页锁定同步退出", async ({
  page,
  context,
  browser,
}) => {
  await login(page);
  const savedDeviceState = await context.storageState();
  const restored = await browser.newContext({
    storageState: savedDeviceState,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const app = await restored.newPage();
    await app.goto("/overview");
    await expect(app.getByRole("heading", { name: "月度总览." })).toBeVisible();
    const otherTab = await restored.newPage();
    await otherTab.goto("/records");
    await expect(
      otherTab.getByRole("heading", { name: "消费明细." }),
    ).toBeVisible();
    await app.getByRole("button", { name: "锁定账本" }).click();
    await expect(
      otherTab.getByRole("heading", { name: "打开你的账本" }),
    ).toBeVisible();
  } finally {
    await restored.close();
  }
});
