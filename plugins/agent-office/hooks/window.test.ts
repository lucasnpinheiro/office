import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, scrollInfo } from './compact'
import type { AgentLike } from './office'

const caps = detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8' })
const T = 1_000_000
const mk = (n: number): AgentLike[] => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, description: `QA: agente ${i}`, status: 'working', startedAt: T + i, seenAt: T + 5000, steps: [{ tool: 'Bash', label: 'Bash ls', startedAt: T + i, durationMs: 500, ok: true }] } as AgentLike))
const run = (mode: string, maxLines: number, scroll = 0, width = 100) => renderCompact(mk(40), T + 6000, { width, caps, mode, query: '', expanded: new Set(), maxCardRows: 4, sort: 'time', filter: 'all', maxLines, scroll } as any).map(l => l.map(x => x.t).join(''))

test('T-603 every list tab fits maxLines, keeps the footer last and says how many rows are hidden', () => {
  for (const mode of ['tree', 'waterfall', 'cost', 'tools']) for (const max of [20, 30]) {
    const rows = run(mode, max)
    expect(rows.length).toBeLessThanOrEqual(max)
    expect(rows.join('\n')).toMatch(/↓ \d+ mais/)
    expect(rows.slice(-3).join('\n')).toContain('Concluído') // legend (footer) still visible
    const deep = run(mode, max, 9999)
    expect(deep.length).toBeLessThanOrEqual(max)
    expect(deep.join('\n')).toMatch(/↑ \d+ mais/); expect(deep.join('\n')).not.toMatch(/↓ \d+ mais/)
    expect(scrollInfo.max).toBeGreaterThan(0)
  }
})

test('T-603 nothing hidden, nothing said', () => {
  const rows = renderCompact(mk(2), T + 6000, { width: 100, caps, mode: 'cost', query: '', expanded: new Set(), maxCardRows: 4, sort: 'time', filter: 'all', maxLines: 30 } as any).map(l => l.map(x => x.t).join(''))
  expect(rows.join('\n')).not.toMatch(/[↑↓] \d+ mais/)
})
