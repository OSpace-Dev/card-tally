import { test, expect } from "@playwright/test";
const key = process.env.LEDGER_TEST_ACCESS_KEY!;

test("JavaScript 未加载时仍显示启动页，加载后正常进入", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/*.js", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator(".startup-screen")).toBeVisible();
    await expect(page.locator(".startup-screen h1")).toHaveText("卡有数");
    release();
    await expect(
      page.getByRole("heading", { name: "打开你的账本" }),
    ).toBeVisible();
    await expect(page.locator(".startup-screen")).toHaveCount(0);
  } finally {
    release();
  }
});

test("手机统计先看各卡当月情况，图表进入二级明细且可刷新与返回", async ({
  page,
  request,
}) => {
  const headers = { Authorization: `Bearer ${key}` };
  const created = await request.post("/api/cards", {
    headers,
    data: {
      bank: "图表测试银行",
      name: "当月关注卡",
      last4: "7621",
      color: "#16665b",
    },
  });
  const cardId = (await created.json()).id;
  const now = new Date(),
    year = now.getFullYear(),
    monthNumber = now.getMonth() + 1;
  const currentMonth = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const next = new Date(year, monthNumber, 1);
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  const transactions: number[] = [];
  for (const entry of [
    { amount: "60", date: `${currentMonth}-15`, type: "expense" },
    { amount: "10", date: `${currentMonth}-20`, type: "refund" },
    { amount: "90", date: `${nextMonth}-05`, type: "expense" },
  ]) {
    const result = await request.post("/api/transactions", {
      headers,
      data: { card_id: cardId, category: "其他消费", ...entry },
    });
    transactions.push((await result.json()).id);
  }
  try {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(
      (value) => localStorage.setItem("card-tally.access-key", value),
      key,
    );
    await page.goto("/card-statistics");
    await expect(
      page.getByRole("heading", {
        name: `${year}年${monthNumber}月 · 各卡当月情况`,
      }),
    ).toBeVisible();
    const card = page
      .locator(".monthly-card")
      .filter({ hasText: "图表测试银行" });
    await expect(card).toContainText("¥60.00");
    await expect(card).toContainText("¥10.00");
    await expect(card).toContainText("¥50.00");
    await expect(page.locator(".monthly-card .category-track")).toHaveCount(0);
    await expect(page.locator(".inline-card-trend")).toHaveCount(0);
    const toggle = card.getByRole("button", {
      name: "展开全年趋势 ↓",
      exact: true,
    });
    await toggle.click();
    await expect(card.locator(".inline-card-trend")).toBeVisible();
    await expect(
      card.getByRole("button", { name: "收起全年趋势 ↑", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await card
      .getByRole("button", { name: "收起全年趋势 ↑", exact: true })
      .click();
    await expect(card.locator(".inline-card-trend")).toHaveCount(0);
    await toggle.click();
    await expect(card.locator(".year-chart-column")).toHaveCount(12);
    expect(
      (await page.locator(".year-chart").boundingBox())!.height,
    ).toBeLessThan(180);
    await expect(page.locator(".monthly-detail-list")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: `${currentMonth} ¥60.00，查看明细`,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/card-statistics/${cardId}/months`),
    );
    await expect(page.locator(".monthly-detail-list article")).toHaveCount(12);
    await expect(
      page.locator(".monthly-detail-list article.selected"),
    ).toContainText("¥50.00");
    await page.reload();
    await expect(
      page.locator(".monthly-detail-list article.selected"),
    ).toContainText("¥50.00");
    await page
      .getByRole("button", { name: `查看${currentMonth}消费明细`, exact: true })
      .click();
    await expect(page).toHaveURL(/\/records$/);
    await expect(page.locator(".mobile-record")).toHaveCount(2);
    await page.goBack();
    await expect(page.locator(".monthly-detail-list article")).toHaveCount(12);
    await page
      .getByRole("button", { name: "← 返回各卡当月统计", exact: true })
      .click();
    await expect(page.locator(".year-chart")).toHaveCount(0);
    await page.getByRole("button", { name: "下个月", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: `${next.getFullYear()}年${next.getMonth() + 1}月 · 各卡当月情况`,
      }),
    ).toBeVisible();
    await expect(card).toContainText("¥90.00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    for (const id of transactions)
      await request.delete(`/api/transactions/${id}`, { headers });
    await request.delete(`/api/cards/${cardId}`, { headers });
  }
});

test("多卡趋势分别就地展开，不折叠其他卡片或按金额重排", async ({
  page,
  request,
}) => {
  const headers = { Authorization: `Bearer ${key}` },
    ids: number[] = [];
  try {
    for (const last4 of ["1231", "1232"]) {
      const created = await request.post("/api/cards", {
        headers,
        data: {
          bank: "就地展开测试银行",
          name: "趋势卡",
          last4,
          color: "#16665b",
        },
      });
      ids.push((await created.json()).id);
    }
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(
      (value) => localStorage.setItem("card-tally.access-key", value),
      key,
    );
    await page.goto("/card-statistics");
    const first = page.locator(".monthly-card").filter({ hasText: "1231" });
    const second = page.locator(".monthly-card").filter({ hasText: "1232" });
    await first
      .getByRole("button", { name: "展开全年趋势 ↓", exact: true })
      .click();
    await expect(first.locator(".year-chart")).toBeVisible();
    await second.getByRole("button", { name: /查看全年趋势/ }).click();
    await expect(second.locator(".year-chart")).toBeVisible();
    await expect(first.locator(".year-chart")).toBeVisible();
    await expect(page.locator(".inline-card-trend")).toHaveCount(2);
    const order = await page.locator(".monthly-card-title").allTextContents();
    await page.locator('.statistics-metric .el-select__wrapper').click();
    await page.getByRole("option", { name: "净支出", exact: true }).click();
    expect(await page.locator(".monthly-card-title").allTextContents()).toEqual(
      order,
    );
    await expect(second.locator(".inline-trend-heading")).toContainText(
      "净支出趋势",
    );
    await second
      .getByRole("button", { name: "收起全年趋势 ↑", exact: true })
      .click();
    await expect(first.locator(".year-chart")).toBeVisible();
    await expect(second.locator(".year-chart")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    for (const id of ids) await request.delete(`/api/cards/${id}`, { headers });
  }
});
