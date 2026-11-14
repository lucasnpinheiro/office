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
const mountApp = ($: any, cols: number) => $.ui.mount({
  plugin: 'agent-office', surface: 'desktop', component: 'Pane', requestId: 'agent-office',
  props: { bodyColumns: cols, bodyRows: 60 } as any, viewport: { columns: cols, rows: 60 } as any,
})
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
const boxTops = (rows: string[]) => rows.map(r => count(r, /╭[─┴]{32}╮/g))

test('real pane, 12 agents, 110 cols: header box, Geral bar, parent card, bus, sibling boxes, legend, one hint row', async ($, on) => {
  await boot($, on)
  const rows = await rowsOf(await mount($, 110, 44)) // 44 rows: the tree is taller than the pane, so it scrolls
  const out = rows.join('\n')
  expect(out).toContain('Office Agent Monitor · meuapp · #abcdef')
  expect(out).toContain('Geral ')
  expect(out).toContain('Claude Code'); expect(out).toContain('Orquestrador') // main session = parent card
  expect(out).not.toContain('rodando ·') // not the one-line map
  expect(rows.some(r => /^ *╭┄+/.test(r))).toBe(true) // bus from the parent card, hung off the trunk
  expect(Math.max(...boxTops(rows))).toBe(3) // 3 x 34 + 2 gaps + trunk = 108 <= 110
  expect(rows.filter(r => /^[ ┊]*╭[─┴]{32}╮/.test(r)).length).toBeGreaterThan(2) // parent + at least two sibling rows
  expect(out).not.toContain('cards ocultos'); expect(out).toContain('mais cards abaixo · j desce') // short pane: a scrolling window of full cards
  expect(out).toContain('Concluído'); expect(out).toContain('barramento')
  expect(rows.filter(r => r.includes('fechar')).length).toBe(1) // one hotkey row; its hint tail only when it fits
})

test('real pane, 12 agents, 200 cols: 5 siblings per row, all 12 visible, no overflow box', async ($, on) => {
  await boot($, on)
  const rows = await rowsOf(await mount($, 200))
  const out = rows.join('\n')
  expect(Math.max(...boxTops(rows))).toBe(5)
  expect(count(out, /│[^│]*QA: teste \d+/g)).toBe(12)
  expect(out).not.toContain('cards ocultos')
})

test('terminal session.start opens the cards of the design (TELA 8), whatever view the previous session left', async ($, on) => {
  await boot($, on, 2)
  await $.command.run({ command: 'office', args: 'view map' } as any)
  await $.session.start({ cwd: '/work/meuapp', surface: 'terminal', isInteractive: true } as any)
  const out = (await rowsOf(await mount($, 110))).join('\n')
  expect(out).toContain('Office Agent Monitor · meuapp'); expect(out).toContain('Geral '); expect(out).toMatch(/╭─{32}╮/)
  expect(out).not.toContain('Progresso geral')
})

test('terminal, session.start without a surface field: the first render still lands on the cards (surface read at render)', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', isInteractive: true } as any)
  for (let i = 1; i <= 3; i++) await $.agent.spawn({ tool_use_id: `s${i}`, prompt: 'p', description: `QA: teste ${i}` } as any)
  const out = (await rowsOf(await mount($, 120))).join('\n')
  expect(out).toContain('Geral '); expect(out).toMatch(/╭─{32}╮/); expect(out).toMatch(/╭┄+[┬┼]/)
})

test('desktop, session.start without a surface field: the map (org chart of Box cards) still opens', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', isInteractive: true } as any)
  for (let i = 1; i <= 2; i++) await $.agent.spawn({ tool_use_id: `d${i}`, prompt: 'p', description: `QA: teste ${i}` } as any)
  const keys = (await (await mountApp($, 120)).findAll({ type: 'Box' })).map((b: any) => String(b.key ?? b.props?.key ?? ''))
  expect(keys.some((k: string) => k.startsWith('map-'))).toBe(true)
})

test('terminal has one view: /office view map draws the centred cards, never a boxed org chart', async ($, on) => {
  await boot($, on, 2)
  await $.command.run({ command: 'office', args: 'view map' } as any)
  const out = (await rowsOf(await mount($, 110))).join('\n')
  expect(out).toContain('Office Agent Monitor'); expect(out).toContain('Geral '); expect(out).toMatch(/╭[─┴]{32}╮/)
  expect(out).not.toContain('Progresso geral'); expect(out).not.toContain('┌')
})

test('terminal footer: the hotkey row never exceeds the pane width (the hint tail is dropped first)', async ($, on) => {
  await boot($, on, 2)
  for (const cols of [64, 100, 170]) {
    const pane = await mount($, cols)
    const rows = await rowsOf(pane)
    await pane.unmount()
    if (cols >= 100) expect(rows.some(r => r.includes('fechar'))).toBe(true)
    if (cols >= 170) expect(rows.some(r => r.includes('Tab entre cards'))).toBe(true)
    for (const r of rows) expect([...r].length).toBeLessThanOrEqual(cols)
  }
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
  for (let i = 1; i <= 2; i++) await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `🛠️ Mid-level · 🎼 Sonnet · 🟡 médio: Tarefa ${i}` } as any)
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
  expect(t.some(x => x.includes('🛠️ Mid-level · 🎼 Sonnet · 🟡 médio'))).toBe(true)
  expect(t).toContain('Na fila')
  const open = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key ?? '')).find(k => k.startsWith('app-open-'))!
  await ui.press({ key: open })
  await ui.unmount(); ui = await mountD()
  t = await texts()
  expect(t.some(x => x.includes('Office › ') && x.includes('Mid-level'))).toBe(true) // crumb
  expect(t).toContain('Linha do tempo'); expect(t).toContain('Tempo'); expect(t).toContain('Tokens'); expect(t).toContain('Custo')
  expect(t.some(x => x.includes('Prompt'))).toBe(true)
  expect(await ui.find({ key: 'office-back' })).toBeDefined() // [Fechar]
  expect(t).toContain('Mapa') // tree stays beside the detail
})

test('real pane, fresh session (0 agents, as right after a reload): the cards header and the waiting line, not the one-line text map', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'terminal', isInteractive: true } as any)
  const out = (await rowsOf(await mount($, 100, 40))).join('\n')
  expect(out).toContain('Office Agent Monitor · meuapp'); expect(out).toContain('Aguardando agentes')
  expect(out).not.toContain('0 rodando')
})

test('real pane, narrow side pane (34 cols, 3 agents): every agent is listed', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'terminal', isInteractive: true } as any)
  for (let i = 1; i <= 3; i++) await $.agent.spawn({ tool_use_id: `n${i}`, prompt: 'p', description: `QA: teste ${i}` } as any)
  const out = (await rowsOf(await mount($, 34, 60))).join('\n')
  expect(out).toContain('teste 1'); expect(out).toContain('teste 3')
})

const boxKeys = async (ui: any) => (await ui.findAll({ type: 'Box' })).map((b: any) => String(b.key ?? b.props?.key ?? ''))

test('desktop map: a single top-level agent with no children is drawn as the root card, not "Aguardando agentes"', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'desktop', isInteractive: true } as any)
  await $.agent.spawn({ tool_use_id: 's1', prompt: 'p', description: '🧭 Squad Leader · 👑 Opus · 🟢 baixo: Orquestrador' } as any)
  const t = (await (await mountApp($, 120)).findAll({ type: 'Text' })).map((x: any) => String(x.text))
  expect(t.some(x => x.includes('Orquestrador'))).toBe(true)
  expect(t.some(x => x.includes('Aguardando agentes'))).toBe(false)
})

test('desktop map: siblings that do not fit wrap into rows hung off a dashed trunk, each row with a dashed bus (same rule as the terminal)', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface: 'desktop', isInteractive: true } as any)
  for (let i = 1; i <= 8; i++) await $.agent.spawn({ tool_use_id: `w${i}`, prompt: 'p', description: `🛠️ Mid-level · 🪶 Haiku · 🟢 baixo: tarefa ${i}` } as any)
  const u1 = await mountApp($, 112)
  const k = await boxKeys(u1) // (112 - 2) / 36 = 3 per row -> 3 rows
  await u1.unmount()
  expect(k.filter(x => x.startsWith('trunk-'))).toEqual(['trunk-session'])
  expect(k.filter(x => x.startsWith('rowbus-')).length).toBe(3)
  const k2 = await boxKeys(await mountApp($, 400)) // everything fits: one solid bus, no trunk
  expect(k2.filter(x => x.startsWith('trunk-')).length).toBe(0)
  expect(k2.filter(x => x.startsWith('rowbus-')).length).toBe(0)
})

test('desktop map: role on every card and a lit pulse on the dashed bus of a row with a running child', async ($, on) => {
  setup($, on)
  on('tool.call', async () => ({ result: { stdout: 'ok', stderr: '' } }) as any)
  await $.session.start({ cwd: '/work/meuapp', surface: 'desktop', isInteractive: true } as any)
  for (let i = 1; i <= 8; i++) await $.agent.spawn({ tool_use_id: `r${i}`, prompt: 'p', description: `QA: teste ${i}` } as any)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'rc1', agentId: 'ag-1', command: 'ls' } as any).catch(() => undefined) // ag-1 is now running
  const ui = await mountApp($, 112)
  const t = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  expect(t).toContain('orquestrador'); expect(t.filter((x: string) => x === 'agente').length).toBe(8)
  const lit = (await ui.findAll({ type: 'Box' })).filter((b: any) => String(b.key ?? b.props?.key ?? '').startsWith('dash-rowbus-') && b.props?.backgroundColor === 'suggestion')
  expect(lit.length).toBeGreaterThan(0)
})
