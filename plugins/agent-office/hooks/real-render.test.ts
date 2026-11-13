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
  await $.command.run({ command: 'office', args: 'view compact' } as any) // the session opens on the map; these tests read the cards
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

test('a compact view left over from the previous session does not survive session.start: the map opens', async ($, on) => {
  await boot($, on, 2)
  await $.session.start({ cwd: '/work/meuapp', surface: 'terminal', isInteractive: true } as any)
  const out = (await rowsOf(await mount($, 110))).join('\n')
  expect(out).toContain('Office Agent Monitor'); expect(out).toContain('Progresso geral'); expect(out).toContain('Claude Code'); expect(out).toMatch(/┌[─┴]{36}┐/)
})

test('desktop surface: the map view draws the org chart as Box cards (root, children), clickable', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'desktop', isInteractive: true } as any)
  for (let i = 1; i <= 2; i++) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `QA: teste ${i}` } as any)
  const ui = await $.ui.mount({
    plugin: 'agent-office', surface: 'desktop', component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: 120, bodyRows: 40 } as any, viewport: { columns: 120, rows: 40 } as any,
  })
  const texts = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text as string)
  expect(texts.some(t => t.includes('Claude Code'))).toBe(true)
  expect(texts.filter(t => t.includes('QA: teste')).length).toBe(2)
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key ?? b.props?.key ?? ''))
  expect(keys.filter(k => k.startsWith('app-open-')).length).toBe(2)
})

test('desktop pane: header, tabs with Mapa selected, map card content, side detail on click', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'desktop', isInteractive: true } as any)
  for (let i = 1; i <= 2; i++) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `🛠️ Pleno · 🎼 Sonnet · 🟡 médio: Tarefa ${i}` } as any)
  const mountD = () => $.ui.mount({
    plugin: 'agent-office', surface: 'desktop', component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: 140, bodyRows: 40 } as any, viewport: { columns: 140, rows: 40 } as any,
  })
  let ui = await mountD()
  const texts = async () => (await ui.findAll({ type: 'Text' })).map((t: any) => String(t.text))
  let t = await texts()
  expect(t).toContain('Office'); expect(t.some(x => x.includes('meuapp'))).toBe(true)
  expect(t.some(x => /rodando · .* concluídos · .* falha/.test(x))).toBe(true)
  for (const k of ['Mapa', 'Árvore', 'Worktrees', 'Workflow', 'Custo', 'Ferramentas']) expect(t).toContain(k)
  const mapa = (await ui.findAll({ type: 'Text' })).find((x: any) => x.text === 'Mapa') as any
  expect(mapa.props?.bold).toBe(true)
  expect(t.some(x => x.includes('🛠️ Pleno · 🎼 Sonnet · 🟡 médio'))).toBe(true)
  expect(t).toContain('Na fila')
  const open = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key ?? '')).find(k => k.startsWith('app-open-'))!
  await ui.press({ key: open })
  await ui.unmount(); ui = await mountD()
  t = await texts()
  expect(t.some(x => x.includes('Office › ') && x.includes('Pleno'))).toBe(true) // crumb
  expect(t).toContain('Linha do tempo'); expect(t).toContain('Tempo'); expect(t).toContain('Tokens'); expect(t).toContain('Custo')
  expect(t.some(x => x.includes('Prompt'))).toBe(true)
  expect(await ui.find({ key: 'office-back' })).toBeDefined() // [Fechar]
  expect(t).toContain('Mapa') // tree stays beside the detail
})
