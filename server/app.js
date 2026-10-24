import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { timingSafeEqual } from 'node:crypto'
import path from 'node:path'

export const CATEGORIES = ['餐饮美食', '购物消费', '交通出行', '生活缴费', '休闲娱乐', '旅行住宿', '教育学习', '其他消费']
class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
const check = (ok, message, status) => { if (!ok) throw new InputError(message, status) }
const text = (value, max, name) => { check(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name}需为 1–${max} 个字符`); return value.trim() }
export function cents(value) {
  check(typeof value === 'string' || typeof value === 'number', '金额格式错误')
  const s = String(value)
  check(/^\d{1,8}(\.\d{1,2})?$/.test(s), '金额最多两位小数，且不超过 99999999.99')
  const [whole, fraction = ''] = s.split('.')
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  check(n > 0, '金额必须大于零'); return n
}
const monthValue = (s) => { check(typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && s >= '1900-01' && s <= '9998-12', '月份格式应为 YYYY-MM（1900–9998 年）'); return s }
const dateValue = (s) => {
  check(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s), '日期格式应为 YYYY-MM-DD')
  monthValue(s.slice(0, 7))
  const d = new Date(`${s}T00:00:00Z`)
  check(!Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s, '日期不存在'); return s
}
const idValue = (s) => { const n = Number(s); check(Number.isSafeInteger(n) && n > 0, '无效 ID'); return n }
const shiftMonth = (month, shift) => { const d = new Date(`${month}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + shift); return d.toISOString().slice(0, 7) }

export function createApp({ dbPath, accessKey, staticDir }) {
  check(typeof accessKey === 'string' && accessKey.length >= 12, '访问密钥至少 12 位')
  const db = new DatabaseSync(dbPath)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT, bank TEXT NOT NULL, name TEXT NOT NULL, last4 TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#16665b', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
      type TEXT NOT NULL CHECK(type IN ('expense','refund')), amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
      date TEXT NOT NULL, category TEXT NOT NULL, merchant TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_card ON transactions(card_id);
    CREATE TABLE IF NOT EXISTS budgets (month TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL CHECK(amount_cents>0));
    PRAGMA user_version=1;`)
  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin'); res.set('X-Frame-Options', 'DENY'); next() })
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    const supplied = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''))
    const expected = Buffer.from(accessKey)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ error: '访问密钥不正确，请重新登录' })
    next()
  })
  app.use(express.json({ limit: '32kb' }))
  app.get('/api/session', (_req, res) => res.json({ ok: true, categories: CATEGORIES }))
  app.get('/api/cards', (_req, res) => res.json(db.prepare('SELECT * FROM cards ORDER BY id').all()))
  function cardData(body) {
    const bank = text(body.bank, 30, '银行名称'), name = text(body.name, 30, '卡片名称')
    check(typeof body.last4 === 'string' && /^\d{4}$/.test(body.last4), '请输入卡号后四位')
    check(typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color), '颜色格式错误')
    return [bank, name, body.last4, body.color]
  }
  app.post('/api/cards', (req, res) => {
    const result = db.prepare('INSERT INTO cards(bank,name,last4,color) VALUES(?,?,?,?)').run(...cardData(req.body))
    res.status(201).json({ id: Number(result.lastInsertRowid) })
  })
  app.put('/api/cards/:id', (req, res) => {
    const result = db.prepare('UPDATE cards SET bank=?,name=?,last4=?,color=? WHERE id=?').run(...cardData(req.body), idValue(req.params.id))
    check(result.changes, '卡片不存在', 404); res.json({ ok: true })
  })
  app.delete('/api/cards/:id', (req, res) => {
    const id = idValue(req.params.id)
    check(!db.prepare('SELECT 1 FROM transactions WHERE card_id=? LIMIT 1').get(id), '该卡有消费记录，不能删除；请先处理关联记录', 409)
    check(db.prepare('DELETE FROM cards WHERE id=?').run(id).changes, '卡片不存在', 404); res.json({ ok: true })
  })
  function transactionData(body) {
    const cardId = idValue(body.card_id)
    check(db.prepare('SELECT id FROM cards WHERE id=?').get(cardId), '请选择有效的信用卡')
    check(['expense', 'refund'].includes(body.type), '记录类型错误')
    check(CATEGORIES.includes(body.category), '请选择有效分类')
    const merchant = body.merchant ?? '', note = body.note ?? ''
    check(typeof merchant === 'string' && merchant.length <= 80, '商户最多 80 字')
    check(typeof note === 'string' && note.length <= 300, '备注最多 300 字')
    return [cardId, body.type, cents(body.amount), dateValue(body.date), body.category, merchant.trim(), note.trim()]
  }
  app.post('/api/transactions', (req, res) => {
    const result = db.prepare('INSERT INTO transactions(card_id,type,amount_cents,date,category,merchant,note) VALUES(?,?,?,?,?,?,?)').run(...transactionData(req.body))
    res.status(201).json({ id: Number(result.lastInsertRowid) })
  })
  app.put('/api/transactions/:id', (req, res) => {
    const result = db.prepare('UPDATE transactions SET card_id=?,type=?,amount_cents=?,date=?,category=?,merchant=?,note=? WHERE id=?').run(...transactionData(req.body), idValue(req.params.id))
    check(result.changes, '记录不存在', 404); res.json({ ok: true })
  })
  app.delete('/api/transactions/:id', (req, res) => {
    check(db.prepare('DELETE FROM transactions WHERE id=?').run(idValue(req.params.id)).changes, '记录不存在', 404); res.json({ ok: true })
  })
  function filters(query) {
    const month = monthValue(query.month)
    let where = ' WHERE t.date >= ? AND t.date < ?', args = [`${month}-01`, `${shiftMonth(month, 1)}-01`]
    if (query.card_id) { where += ' AND t.card_id=?'; args.push(idValue(query.card_id)) }
    if (query.type) { check(['expense', 'refund'].includes(query.type), '记录类型错误'); where += ' AND t.type=?'; args.push(query.type) }
    if (query.category) { check(CATEGORIES.includes(query.category), '分类错误'); where += ' AND t.category=?'; args.push(query.category) }
    if (query.q) { check(typeof query.q === 'string' && query.q.length <= 80, '搜索词最多 80 字'); where += " AND (instr(t.merchant,?)>0 OR instr(t.note,?)>0)"; args.push(query.q, query.q) }
    return { where, args }
  }
  const selectRows = 'SELECT t.*,c.bank,c.name AS card_name,c.last4,c.color FROM transactions t JOIN cards c ON c.id=t.card_id'
  app.get('/api/transactions', (req, res) => {
    const { where, args } = filters(req.query)
    const page = Number(req.query.page || 1), size = Number(req.query.page_size || 15)
    check(Number.isInteger(page) && page > 0 && page <= 100000 && Number.isInteger(size) && size > 0 && size <= 100, '分页参数错误')
    const total = db.prepare('SELECT COUNT(*) AS n FROM transactions t' + where).get(...args).n
    const rows = db.prepare(selectRows + where + ' ORDER BY t.date DESC,t.id DESC LIMIT ? OFFSET ?').all(...args, size, (page - 1) * size)
    res.json({ rows, total })
  })
  app.get('/api/export', (req, res) => {
    const { where, args } = filters(req.query)
    const rows = db.prepare(selectRows + where + ' ORDER BY t.date DESC,t.id DESC').all(...args)
    const csvCell = value => { let s = String(value ?? ''); if (/^[\s]*[=+\-@\t\r\n]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"' }
    const records = [['日期', '银行', '卡片', '尾号', '类型', '金额(元)', '分类', '商户', '备注'], ...rows.map(r => [r.date, r.bank, r.card_name, r.last4, r.type === 'expense' ? '消费' : '退款', (r.amount_cents / 100).toFixed(2), r.category, r.merchant, r.note])]
    res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="ledger-${req.query.month}.csv"`).send('\uFEFF' + records.map(r => r.map(csvCell).join(',')).join('\r\n'))
  })
  app.get('/api/reports/cards', (req, res) => {
    const year = String(req.query.year || '')
    check(/^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9998, '年份应为 1900–9998')
    const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
    const cards = db.prepare('SELECT * FROM cards ORDER BY id').all().map(card => ({
      ...card, months: months.map(month => ({ month, expense: 0, refund: 0, net: 0, count: 0 })),
      expense: 0, refund: 0, net: 0, count: 0,
    }))
    const byId = new Map(cards.map(card => [card.id, card]))
    const totals = db.prepare(`SELECT card_id, substr(date,1,7) AS month,
      SUM(CASE WHEN type='expense' THEN amount_cents ELSE 0 END) AS expense,
      SUM(CASE WHEN type='refund' THEN amount_cents ELSE 0 END) AS refund,
      COUNT(*) AS count FROM transactions WHERE date>=? AND date<? GROUP BY card_id,substr(date,1,7)`)
      .all(`${year}-01-01`, `${Number(year) + 1}-01-01`)
    for (const total of totals) {
      const card = byId.get(total.card_id)
      const entry = card.months[Number(total.month.slice(5)) - 1]
      Object.assign(entry, { expense: total.expense, refund: total.refund, net: total.expense - total.refund, count: total.count })
      card.expense += entry.expense; card.refund += entry.refund; card.net += entry.net; card.count += entry.count
    }
    res.json({ year: Number(year), months, cards })
  })
  app.get('/api/report', (req, res) => {
    const month = monthValue(req.query.month)
    const rows = db.prepare(selectRows + ' WHERE t.date>=? AND t.date<? ORDER BY t.date,t.id').all(`${month}-01`, `${shiftMonth(month, 1)}-01`)
    let expense = 0, refund = 0
    const byCard = new Map(), byCategory = new Map(), daily = new Map()
    for (const row of rows) {
      const signed = row.type === 'expense' ? row.amount_cents : -row.amount_cents
      if (row.type === 'expense') expense += row.amount_cents; else refund += row.amount_cents
      if (!byCard.has(row.card_id)) byCard.set(row.card_id, { id: row.card_id, bank: row.bank, name: row.card_name, last4: row.last4, color: row.color, expense: 0, refund: 0, net: 0, count: 0 })
      const card = byCard.get(row.card_id); card[row.type] += row.amount_cents; card.net += signed; card.count++
      if (!byCategory.has(row.category)) byCategory.set(row.category, { name: row.category, expense: 0, refund: 0, net: 0 })
      const category = byCategory.get(row.category); category[row.type] += row.amount_cents; category.net += signed
      daily.set(row.date, (daily.get(row.date) || 0) + signed)
    }
    const trends = []
    for (let i = -5; i <= 0; i++) {
      const m = shiftMonth(month, i)
      const totals = db.prepare("SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents ELSE 0 END),0) AS expense, COALESCE(SUM(CASE WHEN type='refund' THEN amount_cents ELSE 0 END),0) AS refund FROM transactions WHERE date>=? AND date<?").get(`${m}-01`, `${shiftMonth(m, 1)}-01`)
      trends.push({ month: m, ...totals, net: totals.expense - totals.refund })
    }
    res.json({ month, expense, refund, net: expense - refund, count: rows.length, budget: db.prepare('SELECT amount_cents FROM budgets WHERE month=?').get(month)?.amount_cents || 0, previousNet: trends.at(-2).net, byCard: [...byCard.values()].sort((a, b) => b.net - a.net), byCategory: [...byCategory.values()].sort((a, b) => b.expense - a.expense), daily: [...daily].map(([date, net]) => ({ date, net })), trends })
  })
  app.put('/api/budget', (req, res) => {
    const month = monthValue(req.body.month)
    if (req.body.amount === '' || req.body.amount === null || req.body.amount === '0') db.prepare('DELETE FROM budgets WHERE month=?').run(month)
    else db.prepare('INSERT INTO budgets(month,amount_cents) VALUES(?,?) ON CONFLICT(month) DO UPDATE SET amount_cents=excluded.amount_cents').run(month, cents(req.body.amount))
    res.json({ ok: true })
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }))
  if (staticDir) {
    app.use(express.static(staticDir))
    app.get(/.*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')))
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: status >= 500 ? '服务异常，请检查服务端日志' : err.message })
  })
  return { app, db }
}
