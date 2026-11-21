import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, MODES } from './compact'
import { appCards, appMap } from './app-cards'
import { detailView } from './view-detail'
import { MASK } from './mask'
import type { AgentLike } from './office'

// fake secrets, shaped like the mask.ts RULES; never real credentials
const GH = 'ghp_' + 'Ab3'.repeat(12)            // ghp_ + 36
const SK = 'sk-' + 'Zq9'.repeat(14)             // sk- + 42
const BEARER = 'Bearer abcDEF123ghiJKL456mnoPQR'
const T = 1_000_000
const NAME = `QA revisar ${GH} e ${SK}`
const DESC = `Use token ${BEARER} para testar`
const agents = (): AgentLike[] => [
  { id: 'a1', description: NAME, status: 'working', startedAt: T, seenAt: T + 9000, steps: [], prompt: DESC } as any,
  { id: 'a2', description: `Filho ${GH}`, status: 'working', startedAt: T + 1000, seenAt: T + 9000, steps: [], parentId: 'a1' } as any,
]
const TOK = 'abcDEF123ghiJKL456mnoPQR' // bearer value; the word Bearer itself stays visible
const SECRETS = [GH, SK, TOK]
const caps = detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8' })
const base = { caps, query: '', expanded: new Set<string>(), maxCardRows: 4, sort: 'time', filter: 'all' } as any
const assertClean = (out: string, where: string, named = true) => {
  for (const s of SECRETS) expect({ where, leak: out.includes(s) }).toEqual({ where, leak: false })
  for (const s of SECRETS) expect({ where, leak: out.includes(s.slice(0, 6)) }).toEqual({ where, leak: false })
  if (named) expect({ where, masked: out.includes(MASK) }).toEqual({ where, masked: true })
}

for (const mode of MODES) test(`mask-views: compact ${mode} masks agent names`, () => {
  for (const width of [80, 120]) {
    const out = renderCompact(agents(), T + 10_000, { ...base, width, mode } as any).map(l => l.map(x => x.t).join('')).join('\n')
    assertClean(out, `@`, !['grouped', 'tools', 'workflow'].includes(mode))
  }
})

test('mask-views: app cards and app map mask names', () => {
  const now = T + 10_000
  const cards = JSON.stringify(appCards(agents() as any, now, {}))
  assertClean(cards, 'app-cards')
  assertClean(JSON.stringify(appMap(agents() as any, now, {})), 'app-map')
})

test('mask-views: detail view masks name and prompt', () => {
  const out = detailView(agents(), 'a1', T + 10_000, { width: 80 } as any)
  const text = JSON.stringify(out)
  assertClean(text, 'detail')
})

test('mask-views: sort and search use the masked display name', () => {
  const out = renderCompact(agents(), T + 10_000, { ...base, width: 80, mode: 'grouped', query: 'QA revisar', sort: 'name' } as any).map(l => l.map(x => x.t).join('')).join('\n')
  expect(out).toContain('QA revisar')
  const none = renderCompact(agents(), T + 10_000, { ...base, width: 80, mode: 'grouped', query: GH } as any).map(l => l.map(x => x.t).join('')).join('\n')
  expect(none.includes(GH)).toBe(false)
})

// truncation boundary: secret straddles the clip width, no 6+ char prefix may survive
for (const [where, mode] of [['waterfall', 'waterfall'], ['tree', 'tree'], ['cards', 'cards']] as const) test(`mask-views: long name boundary ${where} 80 cols`, () => {
  for (let n = 30; n <= 60; n += 3) {
    const long = [{ id: 'b1', description: 'x'.repeat(n) + ' ' + GH + ' tail', status: 'working', startedAt: T, seenAt: T + 9000, steps: [] } as any]
    const out = renderCompact(long, T + 10_000, { ...base, width: 80, mode } as any).map(l => l.map(x => x.t).join('')).join('\n')
    for (let k = 6; k <= GH.length; k++) expect({ n, leak: out.includes(GH.slice(0, k)) }).toEqual({ n, leak: false })
  }
})
