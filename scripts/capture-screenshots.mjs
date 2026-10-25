import { chromium } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/app.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(path.join(root, "dist/index.html")))
  throw new Error("Run npm run build first");
const output = path.join(root, "docs/screenshots");
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(path.join(tmpdir(), "card-tally-screenshots-"));
const accessKey = randomBytes(24).toString("base64url");
const { app, db } = createApp({
  dbPath: path.join(temporary, "demo.sqlite"),
  accessKey,
  staticDir: path.join(root, "dist"),
});
const cardInsert = db.prepare(
  "INSERT INTO cards(bank,name,last4,color) VALUES(?,?,?,?)",
);
// All cards, merchants and amounts below are fictional demonstration records.
for (const card of [
  ["招商银行", "日常生活卡", "1024", "#16665b"],
  ["中国建设银行", "家庭开支卡", "2048", "#3459a3"],
  ["交通银行", "出行旅行卡", "4096", "#6b4e99"],
])
  cardInsert.run(...card);
const insert = db.prepare(
  "INSERT INTO transactions(card_id,type,amount_cents,date,category,merchant,note) VALUES(?,?,?,?,?,?,?)",
);
const samples = [
  [1, "餐饮美食", "工作日午餐", 3850],
  [1, "餐饮美食", "周末家庭聚餐", 26800],
  [1, "购物消费", "日常用品采购", 15990],
  [2, "生活缴费", "水电燃气缴费", 32680],
  [2, "购物消费", "家庭超市采购", 21860],
  [3, "交通出行", "通勤交通", 4500],
  [1, "休闲娱乐", "周末电影", 9800],
  [2, "教育学习", "图书与课程", 16800],
  [3, "旅行住宿", "短途出游住宿", 62800],
  [1, "餐饮美食", "咖啡与简餐", 5200],
  [2, "购物消费", "家居收纳用品", 19900],
  [3, "交通出行", "出行加油", 28500],
  [1, "购物消费", "运动装备", 39900],
  [2, "生活缴费", "宽带与话费", 16900],
  [1, "餐饮美食", "周末早午餐", 12800],
  [3, "休闲娱乐", "公园活动", 8000],
  [2, "购物消费", "生鲜食材", 12650],
  [1, "其他消费", "生活零星支出", 3500],
];
for (let month = 5; month <= 10; month++) {
  for (let index = 0; index < samples.length; index++) {
    const [cardId, category, merchant, amount] = samples[index];
    const date = `2026-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    const adjusted = Math.round(
      amount * (month === 10 ? 1 : 0.76 + (month % 3) * 0.18),
    );
    insert.run(cardId, "expense", adjusted, date, category, merchant, "");
  }
  insert.run(
    1,
    "refund",
    9900,
    `2026-${String(month).padStart(2, "0")}-16`,
    "购物消费",
    "商品退货退款",
    "退款按实际到账月份记录",
  );
}
insert.run(2, "refund", 6800, "2026-10-18", "购物消费", "家居用品退款", "");
db.prepare("INSERT INTO budgets(month,amount_cents) VALUES(?,?)").run(
  "2026-10",
  600000,
);
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
let browser;
try {
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {},
  );
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1060 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const settled = () =>
    page.waitForFunction(
      () => document.querySelectorAll(".el-loading-mask").length === 0,
    );
  await page.clock.setFixedTime(new Date("2026-10-18T12:00:00+08:00"));
  await page.goto("/");
  await page.getByPlaceholder("粘贴访问密钥").fill(accessKey);
  await page.getByRole("button", { name: "进入账本", exact: true }).click();
  await page.locator(".primary-metric").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(output, "desktop-overview.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "消费明细", exact: true })
    .click();
  await page.locator(".desktop-table tbody tr").first().waitFor();
  await settled();
  await page.screenshot({
    path: path.join(output, "desktop-transactions.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 1050 });
  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "各卡月度统计", exact: true })
    .click();
  await page.locator(".monthly-card").first().waitFor();
  await settled();
  await page.screenshot({
    path: path.join(output, "mobile-card-statistics.png"),
    animations: "disabled",
  });
  await page
    .locator(".monthly-card")
    .first()
    .getByRole("button", { name: "展开全年趋势 ↓", exact: true })
    .click();
  await page.locator(".year-chart").waitFor();
  await settled();
  await page.screenshot({
    path: path.join(output, "mobile-card-trend.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "记一笔", exact: true }).click();
  await page.getByRole("group", { name: "金额数字键盘" }).waitFor();
  for (const value of ["1", "2", "8", ".", "5", "0"])
    await page
      .getByRole("button", {
        name: value === "." ? "小数点" : `数字${value}`,
        exact: true,
      })
      .click();
  await page.screenshot({
    path: path.join(output, "mobile-quick-entry.png"),
    animations: "disabled",
  });
  console.log(
    "Generated 5 screenshots using an isolated fictional ledger in docs/screenshots/.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(temporary, { recursive: true, force: true });
}
