import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp, cents } from '../server/app.js'

import { randomBytes } from 'node:crypto'
const key = randomBytes(24).toString('base64url')
let server, db, base, directory, cardId, expenseId
async function api(url, method = 'GET', body, authenticated = true) {
  const response = await fetch(base + url, { method, headers: { ...(authenticated ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text()
  return { status: response.status, data, headers: response.headers }
}
const transaction = (changes = {}) => ({ card_id: cardId, type: 'expense', amount: '120.35', date: '2026-03-15', category: '餐饮美食', merchant: '午餐', note: '', ...changes })
before(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'card-ledger-'))
  const instance = createApp({ dbPath: path.join(directory, 'test.sqlite'), accessKey: key })
  db = instance.db
  server = instance.app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
})
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(directory, { recursive: true, force: true }) })

test('精确转换金额，拒绝零、负数、科学计数法、多余小数', () => {
  assert.equal(cents('0.01'), 1); assert.equal(cents('123.45'), 12345); assert.equal(cents('1.1'), 110)
  for (const amount of ['0', '-1', '1.001', '1e3', '100000000', '', null, {}]) assert.throws(() => cents(amount))
})
test('API 必须带访问密钥，返回禁止缓存头', async () => {
  const denied = await api('/session', 'GET', undefined, false)
  assert.equal(denied.status, 401); assert.equal(denied.headers.get('cache-control'), 'no-store')
  const ok = await api('/session'); assert.equal(ok.status, 200); assert.equal(ok.data.categories.length, 8)
})
test('创建、查询信用卡；只接收四位尾号', async () => {
  const rejected = await api('/cards', 'POST', { bank: '招商银行', name: '日常卡', last4: '123456', color: '#16665b' })
  assert.equal(rejected.status, 400)
  const result = await api('/cards', 'POST', { bank: '招商银行', name: '日常卡', last4: '0123', color: '#16665b' })
  assert.equal(result.status, 201); cardId = result.data.id
  const list = await api('/cards'); assert.equal(list.data[0].last4, '0123')
})
test('新增消费、当月退款和跨月退款', async () => {
  const expense = await api('/transactions', 'POST', transaction()); assert.equal(expense.status, 201); expenseId = expense.data.id
  assert.equal((await api('/transactions', 'POST', transaction({ type: 'refund', amount: '20.10', date: '2026-03-20' }))).status, 201)
  assert.equal((await api('/transactions', 'POST', transaction({ type: 'refund', amount: '10.25', date: '2026-04-01' }))).status, 201)
  assert.equal((await api('/transactions', 'POST', transaction({ amount: '0.01', date: '2026-03-31', category: '其他消费' }))).status, 201)
})
test('按自然月统计，卡片、分类、每日、趋势汇总一致', async () => {
  const { data: r } = await api('/report?month=2026-03')
  assert.equal(r.expense, 12036); assert.equal(r.refund, 2010); assert.equal(r.net, 10026); assert.equal(r.count, 3)
  assert.equal(r.byCard[0].net, 10026); assert.equal(r.byCard[0].count, 3)
  assert.equal(r.byCategory.find(c => c.name === '餐饮美食').net, 10025)
  assert.equal(r.daily.reduce((n, day) => n + day.net, 0), r.net)
  assert.equal(r.trends.length, 6); assert.equal(r.trends.at(-1).net, r.net)
  const { data: april } = await api('/report?month=2026-04')
  assert.equal(april.expense, 0); assert.equal(april.refund, 1025); assert.equal(april.net, -1025); assert.equal(april.previousNet, 10026)
})
test('逐卡全年统计包含零月份、同银行不同卡、跨年及跨月退款', async () => {
  const extra = await api('/cards', 'POST', { bank: '招商银行', name: '第二张卡', last4: '0456', color: '#3459a3' })
  const extraId = extra.data.id
  const otherExpense = await api('/transactions', 'POST', transaction({ card_id: extraId, amount: '50.10' }))
  const nextYear = await api('/transactions', 'POST', transaction({ card_id: extraId, amount: '9.99', date: '2027-01-01' }))
  try {
    const { data: result, status } = await api('/reports/cards?year=2026')
    assert.equal(status, 200); assert.equal(result.months.length, 12); assert.equal(result.cards.length, 2)
    const first = result.cards.find(c => c.id === cardId), second = result.cards.find(c => c.id === extraId)
    assert.equal(first.months.length, 12)
    assert.deepEqual(first.months[0], { month: '2026-01', expense: 0, refund: 0, net: 0, count: 0 })
    assert.deepEqual(first.months[2], { month: '2026-03', expense: 12036, refund: 2010, net: 10026, count: 3 })
    assert.equal(first.months[3].net, -1025)
    assert.equal(first.net, 9001)
    assert.equal(first.net, first.months.reduce((sum, m) => sum + m.net, 0))
    assert.equal(second.months[2].expense, 5010); assert.equal(second.expense, 5010)
    const future = await api('/reports/cards?year=2027')
    assert.equal(future.data.cards.find(c => c.id === extraId).months[0].expense, 999)
    assert.equal(future.data.cards.find(c => c.id === cardId).count, 0)
    for (const year of ['1899', '9999', 'abc', '2026 OR 1=1']) assert.equal((await api('/reports/cards?year=' + encodeURIComponent(year))).status, 400)
    assert.equal((await api('/reports/cards?year=2026', 'GET', undefined, false)).status, 401)
  } finally {
    await api(`/transactions/${otherExpense.data.id}`, 'DELETE')
    await api(`/transactions/${nextYear.data.id}`, 'DELETE')
    await api(`/cards/${extraId}`, 'DELETE')
  }
})

test('无记录月份返回零值和空列表', async () => {
  const { data: r } = await api('/report?month=2025-01')
  assert.equal(r.net, 0); assert.equal(r.count, 0); assert.deepEqual(r.byCard, []); assert.deepEqual(r.daily, [])
})
test('拒绝不存在日期、无效分类/卡片、SQL 注入式月份及非法分页', async () => {
  for (const changes of [{ date: '2026-02-30' }, { date: '2026-13-01' }, { category: '不支持' }, { card_id: 999 }, { amount: '1.234' }, { note: '长'.repeat(301) }, { type: 'income' }]) {
    assert.equal((await api('/transactions', 'POST', transaction(changes))).status, 400)
  }
  for (const url of ['/report?month=2026-13', '/report?month=abc', "/report?month=2026-03%27%20OR%201=1", '/transactions?month=2026-03&page=-1', '/transactions?month=2026-03&page_size=999']) assert.equal((await api(url)).status, 400)
})
test('明细筛选、搜索、分页和退款匹配', async () => {
  const result = await api('/transactions?month=2026-03&page_size=1&page=2')
  assert.equal(result.data.total, 3); assert.equal(result.data.rows.length, 1)
  const refund = await api('/transactions?month=2026-03&type=refund'); assert.equal(refund.data.total, 1)
  const search = await api('/transactions?month=2026-03&q=' + encodeURIComponent('午餐')); assert.equal(search.data.total, 3)
  const empty = await api('/transactions?month=2026-03&q=missing'); assert.equal(empty.data.total, 0)
  const category = await api('/transactions?month=2026-03&category=' + encodeURIComponent('其他消费')); assert.equal(category.data.total, 1)
})
test('单独保存每月预算，支持修改和清除', async () => {
  assert.equal((await api('/budget', 'PUT', { month: '2026-03', amount: '2000.01' })).status, 200)
  assert.equal((await api('/report?month=2026-03')).data.budget, 200001)
  assert.equal((await api('/report?month=2026-04')).data.budget, 0)
  await api('/budget', 'PUT', { month: '2026-03', amount: '3000' })
  assert.equal((await api('/report?month=2026-03')).data.budget, 300000)
  await api('/budget', 'PUT', { month: '2026-03', amount: '' })
  assert.equal((await api('/report?month=2026-03')).data.budget, 0)
})
test('卡片编辑更新展示；关联记录阻止删除', async () => {
  const result = await api(`/cards/${cardId}`, 'PUT', { bank: '招商银行', name: '新版日常卡', last4: '0123', color: '#3459a3' })
  assert.equal(result.status, 200)
  assert.equal((await api('/report?month=2026-03')).data.byCard[0].name, '新版日常卡')
  assert.equal((await api(`/cards/${cardId}`, 'DELETE')).status, 409)
})
test('CSV 导出包含全部筛选结果，并转义公式和引号', async () => {
  await api(`/transactions/${expenseId}`, 'PUT', transaction({ merchant: '=HYPERLINK("example")', note: '含,逗号\n和换行' }))
  const csv = await api('/export?month=2026-03&type=expense')
  assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/)
  assert.match(csv.data, /'=HYPERLINK\(""example""\)/)
  assert.match(csv.data, /含,逗号\n和换行/)
  assert.match(csv.data, /120\.35/); assert.doesNotMatch(csv.data, /20\.10/)
})
test('删除记录及无关联卡片；不存在记录返回 404', async () => {
  assert.equal((await api(`/transactions/${expenseId}`, 'DELETE')).status, 200)
  assert.equal((await api(`/transactions/${expenseId}`, 'DELETE')).status, 404)
  const card = await api('/cards', 'POST', { bank: '测试银行', name: '无记录卡', last4: '9999', color: '#16665b' })
  assert.equal((await api(`/cards/${card.data.id}`, 'DELETE')).status, 200)
  assert.equal((await api('/report?month=2026-03')).data.net, -2009)
})
test('服务关闭再打开仍保留卡片和消费', () => {
  const databasePath = path.join(directory, 'restart.sqlite')
  const first = createApp({ dbPath: databasePath, accessKey: key })
  first.db.prepare('INSERT INTO cards(bank,name,last4,color) VALUES(?,?,?,?)').run('测试银行', '持久化卡', '0001', '#16665b')
  first.db.prepare('INSERT INTO transactions(card_id,type,amount_cents,date,category) VALUES(?,?,?,?,?)').run(1, 'expense', 12345, '2026-03-10', '餐饮美食')
  first.db.close()
  const second = createApp({ dbPath: databasePath, accessKey: key })
  try {
    assert.equal(second.db.prepare('SELECT last4 FROM cards WHERE id=1').get().last4, '0001')
    assert.equal(second.db.prepare('SELECT amount_cents FROM transactions WHERE id=1').get().amount_cents, 12345)
  } finally { second.db.close() }
})

test('SQLite 文件持久化且外键生效', () => {
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cards').get().n, 1)
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1)
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
})
