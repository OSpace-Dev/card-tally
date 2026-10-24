import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../server/app.js'
const dir = mkdtempSync(path.join(tmpdir(), 'ledger-browser-'))
const accessKey = process.env.LEDGER_TEST_ACCESS_KEY
if (!accessKey) throw new Error('Run browser tests using the Playwright configuration')
const { app, db } = createApp({ dbPath: path.join(dir, 'test.sqlite'), accessKey, staticDir: path.resolve('dist') })
const server = app.listen(3099, '127.0.0.1')
function close() { server.close(() => { db.close(); rmSync(dir, { recursive: true, force: true }); process.exit(0) }) }
process.on('SIGTERM', close)
process.on('SIGINT', close)
