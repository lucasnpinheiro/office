// Regression tests for the general review (fix/office-review-install).
import { test, expect } from 'claude-code/testing'
import { applyTool } from './stats'
import { isQuotaError, strWidth, truncRunes, truncLine, lineWidth, elapsedOf, buildGraph } from './monitor'
import { renderCompact, detectCaps, statusText, previewLines, detailCompact } from './compact'
import { ticker } from './office'
import type { AgentLike } from './office'

const T0 = 1_700_000_000_000
const mk = (over: Partial<AgentLike> = {}): AgentLike => ({
  id: 'a', agentId: 'g1', description: 'tarefa', status: 'working', startedAt: T0, ...over,
})
const run = ($: any, args: string) => $.command.run({ command: 'office', args })

test('TodoWrite: null/odd entries are skipped, unknown statuses fall back to pending', () => {
  const a = applyTool(mk(), 'TodoWrite', { todos: [null, { content: 'x', status: 'cancelled' }, { content: 42, status: 'completed' }, 'junk'] })
  expect(a.todos).toEqual([{ content: 'x', status: 'pending' }, { content: '42', status: 'completed' }])
})

test('TaskUpdate: an unknown status keeps the old one', () => {
  const a = applyTool(mk({ todos: [{ id: '1', content: 'x', status: 'in_progress' }] }), 'TaskUpdate', { taskId: '1', status: 'weird' })
  expect(a.todos).toEqual([{ id: '1', content: 'x', status: 'in_progress' }])
})

test('quota detection: real limits yes, look-alikes no', () => {
  for (const t of ['429 Too Many Requests', 'rate_limit_error', 'Usage limit reached', 'Credit balance is too low', 'quota exceeded', 'API Error: 429'])
    expect([t, isQuotaError(t)]).toEqual([t, true])
  for (const t of ['credit card field is invalid', 'syntax error at line 429 col 3', 'TypeError: x is undefined'])
    expect([t, isQuotaError(t)]).toEqual([t, false])
})

test('quota: versioned HTTP status lines count', () => {
  expect(isQuotaError('HTTP/1.1 429')).toBe(true)
  expect(isQuotaError('HTTP/2 429')).toBe(true)
})

test('display width: emoji sequences are one two-cell glyph', () => {
  expect(strWidth('❤️')).toBe(2)
  expect(strWidth('👩‍💻')).toBe(2)
  expect(strWidth('🇧🇷')).toBe(2)
  expect(strWidth(truncRunes('👩‍💻👩‍💻👩‍💻', 5))).toBeLessThanOrEqual(5)
})

test('display width: wide glyphs (CJK, emoji) take two cells, combining marks none', () => {
  expect(strWidth('abc')).toBe(3)
  expect(strWidth('日本')).toBe(4)
  expect(strWidth('🧠x')).toBe(3)
  expect(strWidth('é')).toBe(1)
  expect(strWidth(truncRunes('日本語テキスト', 5))).toBeLessThanOrEqual(5)
  expect(lineWidth(truncLine([{ t: '🧠🧠🧠🧠' }], 5))).toBeLessThanOrEqual(5)
})

test('cards stay inside the pane width with wide labels', () => {
  const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
  const ag = [mk({ id: 'a', description: '设计数据库迁移方案并编写测试用例以及文档说明' }), mk({ id: 'b', agentId: 'g2', description: '🧠🧠🧠 análise 🚀🚀🚀 longa demais para caber' })]
  for (const mode of ['cards', 'tree', 'grouped', 'waterfall'] as const) {
    const lines = renderCompact(ag, T0 + 5000, { width: 80, caps, mode, query: '', expanded: new Set(), maxCardRows: 4 })
    for (const l of lines) expect([mode, l.map(s => s.t).join(''), lineWidth(l) <= 80]).toEqual([mode, l.map(s => s.t).join(''), true])
  }
})

test('ticker: only the newest schedule owns the timer', () => {
  const tk = ticker()
  const a = tk.next(), b = tk.next()
  expect(tk.current(a)).toBe(false)
  expect(tk.current(b)).toBe(true)
})

const quiet = (on: any) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.close', async () => ({ value: undefined }))
  on('ui.status', async () => ({ value: undefined }))
  on('ui.focus', async () => ({ value: {} }))
}

test('session.start resets the sort left by a previous run (bare sort cycles from time)', async ($, on) => {
  quiet(on)
  on('command.register', async () => ({ value: { command: 'office' } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  await run($, 'sort name')
  await run($, 'stop')
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await run($, 'sort')).text).toBe('Ordem: state.') // time -> state, not name -> time
  await run($, 'stop')
})

test('/office view: bare toggles, unknown value is refused', async ($, on) => {
  quiet(on)
  await run($, 'start')
  expect((await run($, 'view compact')).text).toBe('Visão: compact.')
  expect((await run($, 'view')).text).toBe('Visão: map.')
  expect((await run($, 'view banana')).text).toContain('map|compact')
  expect((await run($, 'view')).text).toBe('Visão: compact.') // banana changed nothing
  await run($, 'stop')
})

// ---- PR #1 review comments still open in main ----
test('ended quota error: not counted as active, session clock stops', () => {
  const ag = [mk({ id: 'q', status: 'error', error: '429 Too Many Requests', endedAt: T0 + 5000 })]
  expect(statusText(ag, T0 + 60_000)).toContain('0 ativos')
  expect(elapsedOf(buildGraph(ag, T0 + 60_000), T0 + 60_000)).toBe(5000)
})

test('image preview message says "neste modo"', () => {
  expect(previewLines('', 'a.png', 5).map(l => l.map(s => s.t).join('')).join('')).toContain('neste modo')
})

test('ASCII mode: every rendered char is ASCII (header, cards, footer, detail)', () => {
  const caps = detectCaps({ OFFICE_ASCII: '1', LANG: 'en_US.UTF-8' })
  const ag = [mk({ id: 'a', description: 'Análise · migração — “longa”', todos: [{ content: 'ação', status: 'in_progress' }] }), mk({ id: 'b', agentId: 'g2', status: 'error', error: 'falhou…' })]
  for (const mode of ['cards', 'tree', 'grouped', 'waterfall'] as const) {
    const t = renderCompact(ag, T0 + 5000, { width: 120, caps, mode, query: '', expanded: new Set(), maxCardRows: 4 }).map(l => l.map(s => s.t).join('')).join('\n')
    expect([mode, t.replace(/[\x00-\x7f]/g, '')]).toEqual([mode, ''])
  }
  const d = (detailCompact(ag, 'a', T0 + 5000, caps) ?? []).map(l => l.map(s => s.t).join('')).join('\n')
  expect(d.replace(/[\x00-\x7f]/g, '')).toBe('')
  expect(statusText(ag, T0 + 5000, true).replace(/[\x00-\x7f]/g, '')).toBe('')
})

test('header keeps the "Office" title visible at 50 columns', () => {
  const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
  const ag = Array.from({ length: 5 }, (_, i) => mk({ id: 'h' + i, agentId: 'gh' + i }))
  const lines = renderCompact(ag, T0 + 5000, { width: 50, caps, mode: 'cards', query: '', expanded: new Set(), maxCardRows: 4, project: 'meuprojeto', sessionId: 'abcdef123' })
  expect(lines[1]!.map(s => s.t).join('')).toContain('Office')
})

test('/office open <unknown id> in the compact view keeps the cards (no fall-through to the map)', async ($, on) => {
  quiet(on)
  on('session.cwd', async () => ({ value: '/work/meuapp' }))
  on('session.id', async () => ({ value: 'abcdef123' }))
  await run($, 'start')
  await run($, 'view compact')
  await run($, 'open nao-existe')
  const ui = await ($ as any).ui.mount({ plugin: 'agent-office', surface: 'terminal', component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: 120, bodyRows: 40 }, viewport: { columns: 120, rows: 40 } })
  expect(await ui.find({ type: 'Text', text: /Voltar ao mapa/ })).toBeUndefined()
  expect(await ui.find({ key: 'h-g' })).toBeDefined()
  await ui.unmount()
  await run($, 'stop')
})

test('help text names the real keys (no Esc, no "/" key, no [ ])', async ($) => {
  const t = (await run($, 'help')).text as string
  expect(t).not.toContain('Esc')
  expect(t).not.toContain('/ buscar')
  expect(t).not.toContain('[ ]')
  expect(t).toContain('ctrl+x tab')
})
