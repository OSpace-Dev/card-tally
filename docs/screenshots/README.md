# 项目截图

本目录中的图片由实际运行的 CardTally 前端截取，所有账本记录均为脚本生成的虚构数据，不是用户真实消费。截图中的银行名称用于演示，卡号尾号为示例。

| 图片 | 展示内容 |
| --- | --- |
| desktop-overview.png | 电脑月度总览、预算、近六月趋势、各卡与分类汇总 |
| desktop-transactions.png | 电脑消费/退款明细与筛选、导出入口 |
| mobile-card-statistics.png | 手机各卡当月消费、退款和净支出 |
| mobile-card-trend.png | 手机当前卡片内展开全年趋势 |
| mobile-quick-entry.png | 手机极简记账、数字键盘及卡片选择 |

## 重新生成

需要 Node.js 24+，在项目目录执行：

```bash
npm ci
npx playwright install chromium
npm run screenshots
```

Windows 已安装 Edge 时可以省去 Chromium 下载，在 PowerShell 执行：

```powershell
$env:PLAYWRIGHT_CHANNEL = "msedge"
npm run screenshots
```

脚本 `scripts/capture-screenshots.mjs` 会先使用 `dist` 构建产物启动临时服务，在系统临时目录创建独立 SQLite，写入三张演示卡片、2026 年 5–10 月消费/退款和 10 月预算，再使用随机访问密钥登录截图。`npm run screenshots` 包含前端构建步骤。

完成后关闭浏览器与服务并清理临时数据库；不会读写项目 `data/` 或实际部署账本。密钥不输出、不写入截图或仓库。手机截图使用移动视口，不含 iOS 系统状态栏和 Safari 原生界面。

该命令会覆盖本目录中五张同名 PNG。重新生成后应检查图片内容和展示效果，仅提交需要更新的截图；普通使用和部署无需执行此命令。
