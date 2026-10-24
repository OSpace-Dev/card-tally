import { test, expect } from '@playwright/test'

test('首屏按需加载资源，路由仅请求当前页面的数据', async ({ page }) => {
  const key = process.env.LEDGER_TEST_ACCESS_KEY!
  await page.addInitScript(value => localStorage.setItem('card-tally.access-key', value), key)
  const apiPaths: string[] = [], assets: string[] = []
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) apiPaths.push(path)
    if (path.startsWith('/assets/')) assets.push(path)
  })
  await page.goto('/overview')
  await expect(page.locator('.primary-metric')).toBeVisible()
  await expect(page.getByRole('button', { name: '记一笔', exact: true })).toHaveCSS('background-color', 'rgb(22, 102, 91)')
  expect(apiPaths.slice().sort()).toEqual(['/api/cards', '/api/report', '/api/session'])
  expect(assets.some(path => /TransactionDialog|CardDialog|BudgetDialog|RecordsView|InstallInstructions|LoginView/.test(path))).toBe(false)

  await page.locator('.sidebar').getByRole('button', { name: '消费明细' }).click()
  await expect(page.locator('.desktop-table')).toBeVisible()
  await expect.poll(() => apiPaths.filter(path => path === '/api/transactions').length).toBe(1)
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect.poll(() => apiPaths.filter(path => path === '/api/transactions').length).toBe(2)
  expect(apiPaths.filter(path => path === '/api/report')).toHaveLength(1)

  await page.locator('.sidebar').getByRole('button', { name: '各卡月度统计' }).click()
  await expect.poll(() => apiPaths.filter(path => path === '/api/reports/cards').length).toBe(1)
  expect(apiPaths.filter(path => path === '/api/transactions')).toHaveLength(2)
  expect(apiPaths.filter(path => path === '/api/report')).toHaveLength(1)

  const countBeforeCards = apiPaths.length
  await page.locator('.sidebar').getByRole('button', { name: '我的信用卡' }).click()
  await expect(page.locator('.cards-intro')).toBeVisible()
  expect(apiPaths).toHaveLength(countBeforeCards)
  await page.getByRole('button', { name: '添加信用卡', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(assets.some(path => /CardDialog/.test(path))).toBe(true)
})
