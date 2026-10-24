import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'))
mkdirSync(dataDir, { recursive: true })
const keyPath = path.join(dataDir, 'access-key.txt')
let accessKey = process.env.ACCESS_KEY
if (!accessKey) {
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(24).toString('base64url'), { mode: 0o600 })
  accessKey = readFileSync(keyPath, 'utf8').trim()
}
const { app, db } = createApp({ dbPath: path.join(dataDir, 'card-tally.sqlite'), accessKey, staticDir: process.env.SERVE_STATIC !== 'false' && existsSync(path.join(root, 'dist/index.html')) ? path.join(root, 'dist') : undefined })
const host = process.env.HOST || (process.argv.includes('--lan') ? '0.0.0.0' : '127.0.0.1'), port = Number(process.env.PORT || 3001)
const server = app.listen(port, host, () => {
  console.log(`\n卡有数 API / 网站：http://${host}:${port}`)
  console.log(`数据库：${path.join(dataDir, 'card-tally.sqlite')}`)
  console.log(process.env.ACCESS_KEY ? '访问密钥：使用 ACCESS_KEY 环境变量指定的值' : `首次登录请打开本机文件，复制访问密钥：${keyPath}`)
  console.log('开发界面：http://localhost:5173；手机访问请使用电脑局域网 IP。\n')
})
function shutdown() { server.close(() => { db.close(); process.exit(0) }) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
