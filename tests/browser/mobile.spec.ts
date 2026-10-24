import { test, expect } from "@playwright/test";

const accessKey = process.env.LEDGER_TEST_ACCESS_KEY!;
const headers = { Authorization: `Bearer ${accessKey}` };
test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
  serviceWorkers: "block",
});
async function openLedger(
  page: import("@playwright/test").Page,
  url = "/overview",
) {
  await page.addInitScript(
    (key) => localStorage.setItem("card-tally.access-key", key),
    accessKey,
  );
  await page.goto(url);
  await expect(page.locator(".page-heading")).toBeVisible();
}

test("手机选择银行不启用搜索键盘，可单独手动输入；文本输入字号至少 16px", async ({
  page,
}) => {
  await openLedger(page, "/cards");
  await page.getByRole("button", { name: "添加信用卡", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const bank = dialog.getByRole("combobox", { name: "银行名称", exact: true });
  await expect
    .poll(() => bank.evaluate((input: HTMLInputElement) => input.readOnly))
    .toBe(true);
  await dialog.locator(".el-select__wrapper").first().click();
  await expect(
    page.getByRole("option", { name: "招商银行", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "招商银行", exact: true }).click();
  const name = dialog.getByPlaceholder("例如：日常消费卡");
  await name.fill("手机日常卡");
  await expect(name).toHaveCSS("font-size", "16px");
  await dialog.getByRole("button", { name: "未找到？手动输入银行" }).click();
  const customBank = dialog.getByPlaceholder("输入银行名称");
  await customBank.fill("其他测试银行");
  await expect(customBank).toHaveCSS("font-size", "16px");
  await dialog.getByRole("button", { name: "返回银行列表" }).click();
  await expect(
    dialog.getByRole("combobox", { name: "银行名称", exact: true }),
  ).toHaveAttribute("readonly", "");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "消费明细" })
    .click();
  await expect(page.getByRole("textbox", { name: "搜索商户或备注" })).toHaveCSS(
    "font-size",
    "16px",
  );
});

test("极简选卡紧凑、底部按钮易点；慢速保存和刷新期间不能重复提交或重新打开", async ({
  page,
  request,
}, testInfo) => {
  const created = await request.post("/api/cards", {
    headers,
    data: {
      bank: "测试银行",
      name: "手机体验测试卡",
      last4: "8812",
      color: "#16665b",
    },
  });
  const { id: cardId } = await created.json();
  let releasePost!: () => void, releaseRefresh!: () => void;
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  let postCount = 0,
    refreshCount = 0,
    recordId: number | undefined;
  try {
    await openLedger(page);
    await expect(page.locator(".primary-metric")).toBeVisible();
    await page.getByRole("button", { name: "记一笔", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const cardButton = page
      .getByRole("group", { name: "选择记账信用卡" })
      .getByRole("button", { name: /测试银行 · 8812/ });
    await cardButton.click();
    expect((await cardButton.boundingBox())!.height).toBeLessThanOrEqual(46);
    expect((await cardButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const save = dialog.getByRole("button", { name: "保存记录", exact: true });
    for (const button of [
      save,
      dialog.getByRole("button", { name: "取消", exact: true }),
    ]) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(52);
      expect(box.y + box.height).toBeLessThanOrEqual(667);
    }
    await page.getByRole("button", { name: "完整表单", exact: true }).click();
    const inputs = dialog.locator(
      'input:visible:not([type="radio"]):not([type="checkbox"]), textarea:visible',
    );
    for (const input of await inputs.all())
      expect(
        await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    await page.getByRole("button", { name: "极简记账", exact: true }).click();
    await page.getByRole("button", { name: "数字8", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath("mobile-quick-entry.png"),
    });
    await page.route("**/api/transactions", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      postCount++;
      await postGate;
      await route.continue();
    });
    await page.route("**/api/report?*", async (route) => {
      refreshCount++;
      await refreshGate;
      await route.continue();
    });
    await save.click();
    await expect.poll(() => postCount).toBe(1);
    await expect(save).toBeDisabled();
    await expect(
      page
        .locator(".page-heading")
        .getByRole("button", { name: "记一笔", exact: true }),
    ).toBeDisabled();
    // Exercise both handler guards even when native disabled buttons / overlay prevent taps.
    await page.evaluate(() => {
      document
        .querySelector(".page-heading button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      document
        .querySelector(".quick-entry-dialog form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(postCount).toBe(1);
    await expect(dialog.getByPlaceholder("0.00")).toHaveValue("8");
    releasePost();
    await expect.poll(() => refreshCount).toBe(1);
    await expect(dialog).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(
      page
        .locator(".page-heading")
        .getByRole("button", { name: "记一笔", exact: true }),
    ).toBeDisabled();
    releaseRefresh();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "记一笔", exact: true }),
    ).toBeEnabled();
    const now = new Date(),
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const response = await request.get(
      `/api/transactions?month=${month}&card_id=${cardId}`,
      { headers },
    );
    const result = await response.json();
    expect(result.total).toBe(1);
    expect(result.rows[0].amount_cents).toBe(800);
    recordId = result.rows[0].id;
    await page.getByRole("button", { name: "记一笔", exact: true }).click();
    await expect(dialog.getByPlaceholder("0.00")).toHaveValue("");
  } finally {
    releasePost();
    releaseRefresh();
    if (recordId)
      await request.delete(`/api/transactions/${recordId}`, { headers });
    await request.delete(`/api/cards/${cardId}`, { headers });
  }
});
