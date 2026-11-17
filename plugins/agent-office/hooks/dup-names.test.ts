import { test, expect } from 'claude-code/testing'
import { clipName } from './monitor'
import { renderCompact, detectCaps } from './compact'
import type { AgentLike } from './office'

test('T-605 clipName keeps the #n suffix', () => {
  expect(clipName('QA: teste de regressao #3', 24)).toBe('QA: teste de regress… #3'.replace('… #3', '… #3'))
  expect(clipName('QA: teste de regressao #3', 24).endsWith('#3')).toBe(true)
  expect(clipName('curto #2', 24)).toBe('curto #2'); expect(clipName('sem sufixo muito longo mesmo ok', 10)).toBe('sem sufix…')
})

test('T-605 six agents with one name show #1..#6 in Waterfall, Custo and Ferramentas', () => {
  const T = 1_000_000
  const ag = [1, 2, 3, 4, 5, 6].map(i => ({ id: `s${i}`, description: 'QA: teste de regressao', status: 'working', startedAt: T + i * 1000, seenAt: T + 9000, steps: [{ tool: 'Bash', label: 'Bash ls', startedAt: T + i * 1000, durationMs: 500, ok: true }] } as AgentLike))
  const caps = detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8' })
  for (const mode of ['waterfall', 'cost', 'tools'] as const) for (const width of [80, 120]) {
    const out = renderCompact(ag, T + 10_000, { width, caps, mode, query: '', expanded: new Set(), maxCardRows: 4, sort: 'time', filter: 'all' } as any).map(l => l.map(x => x.t).join('')).join('\n')
    for (let i = 1; i <= 6; i++) expect(out).toContain(`#${i}`)
  }
})
