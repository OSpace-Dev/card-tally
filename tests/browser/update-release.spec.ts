import { test, expect } from "@playwright/test";
const key = process.env.LEDGER_TEST_ACCESS_KEY!;
test.use({
  baseURL: "http://127.0.0.1:3100",
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
async function deploy(
  request: import("@playwright/test").APIRequestContext,
  release: string,
  announce?: string,
) {
  const response = await request.post("/__test/deploy", {
    headers: { Authorization: `Bearer ${key}` },
    data: { release, announce },
  });
  return (await response.json()) as { a: string; b: string; c: string };
}
for (const remember of [true, false]) {
  test(`真实A到B更新：SW控制下保留${remember ? "设备" : "标签页"}密钥并运行新构建`, async ({
    page,
    request,
  }) => {
    const versions = await deploy(request, "a");
    await page.goto("/cards");
    await page.getByPlaceholder("粘贴访问密钥").fill(key);
    if (!remember) await page.locator(".remember-device").click();
    await page.getByRole("button", { name: "进入账本", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "我的信用卡." }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-build",
      versions.a,
    );
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await deploy(request, "b");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const notice = page.getByRole("status", { name: "应用版本更新" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "立即更新", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-app-build",
      versions.b,
    );
    await expect(page.locator('meta[name="card-tally-build"]')).toHaveAttribute(
      "content",
      versions.b,
    );
    await expect(
      page.getByRole("heading", { name: "我的信用卡." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (remember) =>
          (remember ? localStorage : sessionStorage).getItem(
            "card-tally.access-key",
          ),
        remember,
      ),
    ).toBe(key);
    const checked = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/version.json",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await checked;
    await expect(notice).toHaveCount(0);
  });
}

test("更新B的预检期间发现C，不改变本次更新目标", async ({ page, request }) => {
  const versions = await deploy(request, "a");
  await page.goto("/cards");
  await page.getByPlaceholder("粘贴访问密钥").fill(key);
  await page.getByRole("button", { name: "进入账本", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "我的信用卡." }),
  ).toBeVisible();
  await deploy(request, "b");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const notice = page.getByRole("status", { name: "应用版本更新" });
  await expect(notice).toBeVisible();
  // Delay the real B response on the server side, independent of SW interception.
  await page.route("**/index.html?update=*", async (route) => {
    const response = await route.fetch();
    await deploy(request, "b", "test-release-c");
    const checked = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/version.json",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await checked;
    await route.fulfill({ response });
  });
  await notice.getByRole("button", { name: "立即更新", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`_app_version=${versions.b}`));
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-build",
    versions.b,
  );
});

test("预检B后发布C时加载当前C，以运行时版本判断而非URL参数", async ({
  page,
  request,
}) => {
  const versions = await deploy(request, "a");
  await page.goto("/cards");
  await page.getByPlaceholder("粘贴访问密钥").fill(key);
  await page.getByRole("button", { name: "进入账本", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "我的信用卡." }),
  ).toBeVisible();
  await deploy(request, "b");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const notice = page.getByRole("status", { name: "应用版本更新" });
  await expect(notice).toBeVisible();
  await request.post("/__test/deploy", {
    headers: { Authorization: `Bearer ${key}` },
    data: { release: "b", switchAfterPreflight: "c" },
  });
  await notice.getByRole("button", { name: "立即更新", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-app-build",
    versions.c,
  );
  await expect(page.locator('meta[name="card-tally-build"]')).toHaveAttribute(
    "content",
    versions.c,
  );
  await expect(
    page.getByRole("heading", { name: "我的信用卡." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("card-tally.access-key")),
  ).toBe(key);
  const checked = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/version.json",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await checked;
  await expect(notice).toHaveCount(0);
});
