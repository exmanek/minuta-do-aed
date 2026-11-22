// Użycie: npm run a11y:contrast  – wypisuje wyniki i zapisuje docs/raport-kontrastu.md. Kod wyjścia 1, gdy jakaś para nie spełnia progu.
import { readFileSync, writeFileSync } from 'node:fs'
import { buildReport, reportMarkdown } from '../src/a11y/contrast.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const rows = buildReport(read('../src/styles/tokens.css'), read('../src/styles/a11y.css'))
const md = reportMarkdown(rows, new Date().toISOString().slice(0, 10))
writeFileSync(new URL('../../docs/raport-kontrastu.md', import.meta.url), md + '\n')
const failed = rows.filter((r) => !r.pass)
for (const r of rows) console.log(`${r.pass ? 'OK  ' : 'FAIL'} [${r.theme}] ${r.ratio.toFixed(2)}:1 (min ${r.min})  ${r.label}`)
console.log(`\n${rows.length - failed.length}/${rows.length} par spełnia próg. Raport: docs/raport-kontrastu.md`)
process.exit(failed.length ? 1 : 0)
