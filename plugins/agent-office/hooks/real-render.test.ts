import { test, expect } from 'claude-code/testing'

// End-to-end through the real module: register -> session.start -> agent.spawn x12 -> ui.render of the Pane on the terminal
// surface. Reads what the pane draws (one string per drawn row), not renderCompact in isolation.
const mount = ($: any, cols: number, rows = 80) =>
  $.ui.mount({
    plugin: 'agent-office', surface: 'terminal', component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: cols, bodyRows: rows } as any, viewport: { columns: cols, rows } as any,
  })
// every drawn row is a row Box whose text is the whole line; the outer column Box is skipped
const rowsOf = async (ui: any): Promise<string[]> =>
  (await ui.findAll({ type: 'Box' })).filter((b: any) => b.props?.flexDirection === 'row' && typeof b.text === 'string' && b.text !== '').map((b: any) => b.text as string)
function setup($: any, on: any) {
  let n = 0
  on('command.register', async () => ({ value: undefined }) as any)
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.focus', async () => ({ value: {} }) as any)
  on('ui.panes', async () => ({ value: [{ id: 'agent-office', title: 'Office', isPlaced: true }] }) as any)
  on('ui.status', async () => ({ value: {} }) as any)
  on('clock.sleep', async (_$: any, e: any) => { await new Promise<void>(r => (globalThis as any).setTimeout(r, e.ms)); return { value: undefined } })
  on('session.cwd', async () => ({ value: '/work/meuapp' }))
  on('session.id', async () => ({ value: 'abcdef123' }))
  on('agent.spawn', async () => ({ model: 'haiku', agentId: `ag-${++n}` }) as any)
  on('classic.SubagentStop', async () => ({}) as any)
}
const boot = async ($: any, on: any, agents = 12) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'terminal', isInteractive: true } as any)
  for (let i = 1; i <= agents; i++) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `QA: teste ${i}` } as any)
}
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
const boxTops = (rows: string[]) => rows.map(r => count(r, /╭─{32}╮/g))

test('real pane, 12 agents, 110 cols: header box, Geral bar, parent card, bus, sibling boxes, legend, one hint row', async ($, on) => {
  await boot($, on)
  const rows = await rowsOf(await mount($, 110, 44)) // 44 rows: not every card fits, so the overflow box shows
  const out = rows.join('\n')
  expect(out).toContain('Office · meuapp · #abcdef')
  expect(out).toContain('Geral ')
  expect(out).toContain('Claude Code'); expect(out).toContain('Orquestrador') // main session = parent card
  expect(out).not.toContain('rodando ·') // not the one-line map
  expect(rows.some(r => /^ ├┄+┬/.test(r))).toBe(true) // bus from the parent card
  expect(Math.max(...boxTops(rows))).toBe(2) // (110 - 5 + 2) / 36 = 2 siblings per row
  expect(rows.filter(r => /^[ ┊]*╭─{32}╮/.test(r)).length).toBeGreaterThan(2) // parent + at least two sibling rows
  expect(out).toContain('cards ocultos')
  expect(out).toContain('Concluído'); expect(out).toContain('barramento')
  expect(rows.filter(r => r.includes('Tab entre cards')).length).toBe(1)
})

test('real pane, 12 agents, 200 cols: 5 siblings per row, all 12 visible, no overflow box', async ($, on) => {
  await boot($, on)
  const rows = await rowsOf(await mount($, 200))
  const out = rows.join('\n')
  expect(Math.max(...boxTops(rows))).toBe(5)
  expect(count(out, /│[^│]*QA: teste \d+/g)).toBe(12)
  expect(out).not.toContain('cards ocultos')
})

test('a map view left over from an older version does not survive session.start', async ($, on) => {
  await boot($, on, 2)
  await $.command.run({ command: 'office', args: 'view map' } as any)
  await $.session.start({ cwd: '/work/meuapp', surface: 'terminal', isInteractive: true } as any)
  const out = (await rowsOf(await mount($, 110))).join('\n')
  expect(out).toContain('Geral '); expect(out).toMatch(/╭─{32}╮/)
})
