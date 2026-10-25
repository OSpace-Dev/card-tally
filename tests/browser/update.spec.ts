import { test, expect } from "@playwright/test";
const accessKey = process.env.LEDGER_TEST_ACCESS_KEY!;
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  serviceWorkers: "block",
});
async function login(page: import("@playwright/test").Page) {
  await page.goto("/cards");
  await page.getByPlaceholder("粘贴访问密钥").fill(accessKey);
  await page.getByRole("button", { name: "进入账本", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "我的信用卡." }),
  ).toBeVisible();
}
const banner = (page: import("@playwright/test").Page) =>
  page.getByRole("status", { name: "应用版本更新" });

test("当前构建不提示更新；前台检查发现新版，稍后可忽略该版本", async ({
  page,
}) => {
  await login(page);
  await expect(banner(page)).toHaveCount(0);
  let version = "test-release-2";
  await page.route("**/version.json?*", (route) =>
    route.fulfill({ json: { buildId: version } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(banner(page)).toBeVisible();
  await banner(page).getByRole("button", { name: "稍后", exact: true }).click();
  await expect(banner(page)).toHaveCount(0);
  version = "test-release-3";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(banner(page)).toBeVisible();
});

test("填表期间暂缓更新提示，关闭表单后展示且不丢失已填内容", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "添加信用卡", exact: true }).click();
  const name = page.getByPlaceholder("例如：日常消费卡");
  await name.fill("保留表单");
  await page.route("**/version.json?*", (route) =>
    route.fulfill({ json: { buildId: "test-release-2" } }),
  );
  const checked = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/version.json",
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await checked;
  await expect(banner(page)).toHaveCount(0);
  await expect(name).toHaveValue("保留表单");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(banner(page)).toBeVisible();
});

test("预检入口未同步时不刷新，一致后可触发用户请求的导航", async ({ page }) => {
  await login(page);
  let deployed = false,
    matching = false;
  await page.route("**/version.json?*", async (route) => {
    if (deployed) await route.continue();
    else await route.fulfill({ json: { buildId: "test-release-2" } });
  });
  await page.route("**/index.html?update=*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (matching) {
      deployed = true;
      await route.fulfill({
        response,
        body: body.replace(
          /(<meta name="card-tally-build" content=")[^"]+/,
          "$1test-release-2",
        ),
      });
    } else await route.fulfill({ response, body });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(banner(page)).toBeVisible();
  await banner(page)
    .getByRole("button", { name: "立即更新", exact: true })
    .click();
  await expect(banner(page)).toContainText("暂时无法更新");
  await expect(page).toHaveURL(/\/cards$/);
  matching = true;
  await banner(page)
    .getByRole("button", { name: "立即更新", exact: true })
    .click();
  await expect(page).toHaveURL(/\/cards\?_app_version=test-release-2$/);
  await expect(
    page.getByRole("heading", { name: "我的信用卡." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("card-tally.access-key")),
  ).toBe(accessKey);
});

test("版本查询网络错误或返回 HTML 不影响账本和登录", async ({ page }) => {
  await page.route("**/version.json?*", (route) => route.abort());
  await login(page);
  await expect(banner(page)).toHaveCount(0);
  await page.unroute("**/version.json?*");
  await page.route("**/version.json?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html>Not deployed yet</html>",
    }),
  );
  const checked = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/version.json",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await checked;
  await expect(banner(page)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "我的信用卡." }),
  ).toBeVisible();
});

test("每5分钟只查询版本：后台跳过，填表不刷新，检查请求不重叠", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  let count = 0,
    release!: () => void;
  let gate: Promise<void> | undefined;
  await page.route("**/version.json?*", async (route) => {
    count++;
    if (gate) await gate;
    await route.fulfill({ json: { buildId: "timer-release-b" } });
  });
  await page.evaluate(() => {
    (window as any).__updateTestMarker = "not-reloaded";
  });
  await page.getByRole("button", { name: "添加信用卡", exact: true }).click();
  await page.getByPlaceholder("例如：日常消费卡").fill("未保存内容");
  await page.clock.runFor(300000);
  await expect.poll(() => count).toBe(1);
  await expect(page.getByPlaceholder("例如：日常消费卡")).toHaveValue(
    "未保存内容",
  );
  expect(await page.evaluate(() => (window as any).__updateTestMarker)).toBe(
    "not-reloaded",
  );
  await expect(banner(page)).toHaveCount(0);
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    }),
  );
  await page.clock.runFor(600000);
  expect(count).toBe(1);
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    }),
  );
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => count).toBe(2);
  release();
  await expect(page.getByPlaceholder("例如：日常消费卡")).toHaveValue(
    "未保存内容",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(banner(page)).toBeVisible();
  const nextCheck = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/version.json",
  );
  await page.clock.runFor(300000);
  await nextCheck;
  expect(count).toBe(3);
  expect(await page.evaluate(() => (window as any).__updateTestMarker)).toBe(
    "not-reloaded",
  );
  await expect(page).toHaveURL(/\/cards$/);
  await expect(banner(page)).toBeVisible();
});
