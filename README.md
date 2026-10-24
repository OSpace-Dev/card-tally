# 卡有数 · CardTally

多银行信用卡记账与月度统计工具，支持手机快速记账、逐卡支出分析和私有部署。

A self-hosted credit card expense tracker with quick mobile entry and monthly spending insights for each card.

面向个人使用的信用卡记账工具。手机记录日常消费，电脑查看每月统计；两端连接同一个服务，共用一份 SQLite 数据库。

技术栈：Vue 3 + TypeScript + Element Plus + Vite，Node.js 24 + Express 5 + Node 内置 SQLite。无需另装数据库，不依赖第三方云服务或在线字体。

## 已实现功能

- 信用卡：新增、修改、删除，保存银行、卡片名称、尾号四位和颜色；内置 27 家银行，按国有大型银行、全国性股份制银行、城市商业银行及其他银行分组，支持搜索、自定义输入及复用已使用的其他银行。
- 记账：消费和退款，支持选择卡片、日期、分类、商户、备注，支持编辑、删除。手机新增默认极简模式，直接显示金额数字键盘和银行卡按钮；金额 + 选卡即可保存，默认今天、消费、其他消费，沿用本次会话上次选择的卡片。可切换完整表单补充信息，编辑记录默认完整表单。
- 月度总览：消费总额、退款总额、净支出、记账笔数、涉及卡片数。
- 月度分析：各卡汇总、消费分类占比、每日净支出、最近六个月趋势及上月环比。
- 各卡月度统计：独立 `/card-statistics` 页面，对照全部卡片全年 12 个月的消费、退款、净支出、笔数，含无记录月份；选择单卡查看全年合计及逐月明细，点击月份金额可跳转消费明细。统计年份跟随顶部所选月份。
- 每月独立预算：进度、剩余额度、超支提示。
- 消费明细：按月份、卡片、分类、类型筛选，搜索商户和备注，分页浏览。
- CSV 导出：导出当前月份和筛选条件下的全部记录，支持 Excel 中文显示。
- 电脑侧边导航与数据表，手机底部导航与消费列表。
- 访问密钥保护所有 API，密钥保存在浏览器标签页会话中，支持锁定账本。

## 快速运行

需要 **Node.js 24 或更新版本**。可通过 `node --version` 确认。Node 24 自带 SQLite，因此无需编译原生数据库依赖。

在当前项目文件夹打开终端：

```bash
git clone https://github.com/OSpace-Dev/card-tally.git
cd card-tally
npm ci
npm run build
npm start
```

打开 **http://localhost:3001**。

首次启动自动创建：

```text
data/
  card-tally.sqlite   实际账本数据库
  access-key.txt      自动生成的访问密钥
```

用文本编辑器打开 `data/access-key.txt`，复制内容到登录页。初始账本为空，先在“我的信用卡”添加卡片，再“记一笔”。项目不会向实际数据库写入演示消费。

若修改前端源码，需要重新执行 `npm run build` 后启动服务。

## 手机和电脑共用

1. 电脑与手机连接同一个 Wi-Fi / 局域网。
2. 在电脑运行：

   ```bash
   npm run start:lan
   ```

3. Windows 运行 `ipconfig`，查找当前 Wi-Fi 或以太网的 IPv4 地址，例如 `192.168.1.23`。
4. 手机浏览器访问 **http://192.168.1.23:3001**，输入同一个访问密钥。
5. 电脑可以继续访问 **http://localhost:3001**。另一台电脑也可使用上述局域网地址。
6. 手机和电脑支持读取同一数据库；另一设备新增后，点击页面月份右侧“刷新账本”，或刷新浏览器获取最新数据。当前不提供实时推送或离线记账。

Windows 防火墙若询问 Node 网络访问，可允许**专用网络**。手机无法访问时检查电脑服务是否启动、IP 是否正确、是否处于访客 Wi-Fi、是否有无线客户端隔离，以及防火墙是否允许 3001 端口。

电脑需保持开机且服务在运行。关闭终端会停止服务，数据仍保留。也可把项目部署到持续运行的家庭服务器或 NAS。手机浏览器可使用“添加到主屏幕”作为快捷入口。

## 统计规则

| 项目 | 口径 |
| --- | --- |
| 月份 | 按记录日期所在自然月，从月初到下月月初，不按银行账单周期 |
| 消费总额 | 本月所有消费金额相加 |
| 退款总额 | 本月实际发生的退款金额相加 |
| 净支出 | 消费总额减退款总额，允许为负数 |
| 记账笔数 | 消费笔数加退款笔数 |
| 各卡汇总 | 每张卡分别计算消费、退款、净支出和笔数 |
| 分类占比 | 分类消费金额 / 本月消费总额，不扣退款 |
| 环比 | 对比上月净支出；上月净支出不大于 0 时不计算百分比 |
| 月度预算 | 按本月全部信用卡净支出计算，退款返还预算额度 |
| 近六月趋势 | 含所选月在内的六个月净支出，点击柱子切换月份 |

例如 3 月消费 120 元、3 月退款 20 元、4 月退款 10 元：3 月净支出 100 元，4 月净支出 -10 元。退款不会回写原消费月份。

金额在数据库按**整数分**保存，输入最多两位小数，支持范围 0.01–99999999.99 元。所有金额按人民币记录，不支持多币种换算。

当前是消费记账工具，不包含银行自动同步、账单日/还款日计算、还款管理、分期、利息或额度管理。界面中的净支出不等于银行待还款额。

## 备份与恢复

**CSV 是消费明细导出，不是完整备份**；卡片和预算需要 SQLite 数据库备份。

个人使用推荐停机复制，步骤如下：

1. 在运行服务的终端按 `Ctrl+C`，等待服务退出。
2. 将整个 `data` 文件夹复制到其他位置，例如 `backups/2026-03-31/data`。
3. 再运行 `npm start` 或 `npm run start:lan`。

复制整个目录能保留访问密钥；SQLite 若存在 `card-tally.sqlite-wal`、`card-tally.sqlite-shm` 文件，也应一并保存。不要在服务运行中仅复制主数据库文件，WAL 中可能还有最新记录。

恢复时先停止服务，备份当前 `data`，再用备份的 `data` 替换，重新启动。所有终端使用恢复后的访问密钥登录。

不要直接编辑 SQLite 文件；`data/` 已被 `.gitignore` 排除，避免随源码提交。

## 开发与测试

```bash
npm run dev        # API 3001 + Vite 5173，热更新
npm run build      # TypeScript 检查 + 生产构建
npm test           # 后端自动化测试，使用临时数据库
```

开发时电脑访问 http://localhost:5173，手机访问 http://电脑局域网IP:5173。Vite 将 `/api` 请求代理到本机 3001，因此开发时 API 保持监听回环地址即可。

浏览器测试：

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

若 Windows 已安装 Edge，可不下载 Chromium，在 PowerShell 使用：

```powershell
$env:PLAYWRIGHT_CHANNEL = "msedge"
npm run test:e2e
```

浏览器测试启动独立 3099 端口和临时数据库，不会写入实际账本。详情见 [测试说明](docs/测试说明.md)。

## 配置与部署

公网部署采用 **Nginx 托管前端静态文件 + Docker Compose 运行后端 API**，按 [公网部署指南](docs/公网部署.md) 操作。根目录提供 `Dockerfile`、`compose.yaml`，配套 Nginx 和备份脚本位于 [deploy/](deploy/)。无需 systemd 管理 Node。

```bash
# 前端在本机构建，将 dist/ 内容上传到 Nginx 网站目录
npm run build
# 后端在服务器启动，数据保存在 compose.yaml 同目录的 ./data
# Linux 首次启动前创建目录并赋予容器用户权限
sudo install -d -o 1000 -g 1000 -m 0700 ./data
docker compose up -d --build
```

Nginx 的 `/api/` 代理到 `127.0.0.1:3001`，页面路由使用 `try_files $uri $uri/ /index.html`。Docker 容器仅运行后端。Nginx 与 Docker 同机时，局域网访问 Nginx 的 80/443 端口即可，不需要开放 API 端口；Nginx 跨主机时，可在 `.env` 设置 `API_BIND_ADDRESS=0.0.0.0`，并将代理目标改成 API 主机实际 IP。完整前后端 Nginx 配置见 [部署模板](deploy/card-tally.nginx.conf)。以下 `npm start` / `start:lan` 仍可用于本机体验与开发。

| 配置项 | 默认值 | 用途 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址，`start:lan` 默认为 `0.0.0.0` |
| `PORT` | `3001` | API 和生产静态网站共用端口 |
| `DATA_DIR` | 项目下 `data` | 数据目录，建议使用绝对路径 |
| `ACCESS_KEY` | 从数据目录自动生成/读取 | 自定义密钥，至少 16 字符，设置后优先于密钥文件 |
| `SERVE_STATIC` | 默认启用，Docker 为 `false` | 是否由后端提供 dist 静态文件 |
| `API_BIND_ADDRESS` | `127.0.0.1` | Compose 宿主机端口绑定，跨主机代理可设置实际局域网 IP 或 `0.0.0.0` |
| `API_PORT` | `3001` | Compose 发布到宿主机的 API 端口 |
| `PLAYWRIGHT_CHANNEL` | 未设置 | 浏览器测试渠道，如 `msedge` |

PowerShell 示例：

```powershell
$env:PORT = "3001"
$env:DATA_DIR = "./ledger-data"
npm run start:lan
```

日常本机或可信家庭局域网使用即可。若部署到公网，使用 HTTPS 反向代理，服务绑定回环地址，保管访问密钥；HTTP 不加密传输。当前是共享密钥的单人/家庭账本，没有独立用户权限或多租户隔离。数据库文件未加密，应依靠主机账户和磁盘权限保护。

服务从项目绝对路径定位数据库。本机运行时可以同时提供 `dist/`；设置 `SERVE_STATIC=false` 时关闭后端静态文件服务（Docker 默认关闭）。公网数据通过目录绑定保存在部署目录的 `./data`，更新容器无需复制数据库。

## 目录

```text
src/
  App.vue                    应用初始化、共享状态提供、全局弹窗
  router.ts                  Vue Router history 路由与页面懒加载
  layouts/AppLayout.vue      导航、页头、月份选择与路由出口
  views/                     登录、月度总览、消费明细、信用卡页面
  composables/useLedger.ts   会话、共享数据、查询与弹窗打开状态
  components/                独立表单弹窗、趋势图
  api.ts                     API 请求、类型、金额格式化
  style.css                  响应式样式
  data/banks.ts              内置银行分组
server/
  app.js                     REST API、SQLite 初始化、统计
  index.js                   启动、密钥及数据目录
Dockerfile                   仅后端的生产镜像
compose.yaml                 API 容器与 ./data 目录绑定
tests/                       API 与浏览器测试
docs/                        数据与接口、测试文档
data/                        首次运行自动创建，不纳入版本控制
dist/                        构建产物
```

更多实现细节见 [数据与接口说明](docs/数据与接口.md)。
