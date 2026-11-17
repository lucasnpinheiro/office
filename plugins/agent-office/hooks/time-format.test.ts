import { test, expect } from 'claude-code/testing'
import { fmtDur, fmtMMSS, fmtHMS } from './monitor'
import { costLines } from './view-cost'
import { renderCompact, detectCaps } from './compact'
import type { AgentLike } from './office'

test('T-604 one time format: mm:ss under 1h, h:mm:ss from 1h', () => {
  expect(fmtDur(0)).toBe('00:00'); expect(fmtDur(65_000)).toBe('01:05'); expect(fmtDur(3_599_000)).toBe('59:59')
  expect(fmtDur(3_600_000)).toBe('1:00:00'); expect(fmtDur(11_362_000)).toBe('3:09:22')
  expect(fmtMMSS(11_362_000)).toBe('3:09:22'); expect(fmtHMS(14_000)).toBe('00:14')
})

test('T-604 waterfall and cost axes use the same format, never raw seconds', () => {
  const T = 1_000_000, H = 3_600_000
  const ag = [{ id: 'a', description: 'Dev: a', status: 'working', startedAt: T, seenAt: T + 3 * H } as AgentLike]
  const now = T + 3 * H + 9 * 60_000 + 22_000
  const caps = detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8' })
  for (const mode of ['waterfall', 'cost'] as const) for (const width of [80, 120]) {
    const out = renderCompact(ag, now, { width, caps, mode, query: '', expanded: new Set(), maxCardRows: 4, sort: 'time', filter: 'all' } as any).map(l => l.map(x => x.t).join('')).join('\n')
    expect(out).not.toMatch(/\d{4,}s/); expect(out).not.toMatch(/\b\d{3,}:\d\d/); expect(out).toContain('3:09:22')
  }
})
