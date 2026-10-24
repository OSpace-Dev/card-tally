import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const manifest = JSON.parse(readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8'))
function measure(roots) {
  const seen = new Set(), files = new Set()
  function visit(key) {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Missing build entry: ${key}`)
    if (chunk.file.endsWith('.js')) files.add(chunk.file)
    for (const css of chunk.css || []) files.add(css)
    for (const dependency of chunk.imports || []) visit(dependency)
  }
  roots.forEach(visit)
  const result = { js: 0, css: 0, gzipJs: 0, gzipCss: 0 }
  for (const file of files) {
    const content = readFileSync(path.join(dist, file))
    const type = file.endsWith('.js') ? 'js' : 'css'
    result[type] += content.length
    result[type === 'js' ? 'gzipJs' : 'gzipCss'] += gzipSync(content).length
  }
  return Object.fromEntries(Object.entries(result).map(([key, bytes]) => [key, `${(bytes / 1000).toFixed(2)} kB`]))
}
console.table({
  '入口静态依赖': measure(['index.html']),
  '入口 + 总览页': measure(['index.html', 'src/views/OverviewView.vue']),
  '入口 + 明细页': measure(['index.html', 'src/views/RecordsView.vue']),
})
console.log('统计 JS/CSS 及其静态依赖，排除未打开的弹窗和其他动态页面；gzip 是逐文件压缩估算，不代表实际服务器响应时间。')
