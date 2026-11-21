import { test, expect } from 'claude-code/testing'

// Mouse wheel: the host raises ui.scroll (by = +1 down, -1 up, origin person) over the pane body; the plugin turns it into the j/k scroll step.
const mount = ($: any, cols = 120, rows = 80) =>
  $.ui.mount({
    plugin: 'agent-office', surface: 'terminal', component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: cols, bodyRows: rows } as any, viewport: { columns: cols, rows } as any,
  })

type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number }
const USAGE = (n: number): Usage => ({ input_tokens: n, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 })

// ui.open/focus/status/session answers, a spawn that gives each agent a distinct agentId, and a turn.step that answers the usage the test sets
function setup($: any, on: any, o: { process?: (argv: readonly string[], cwd?: string) => unknown; usd?: number; noAgentId?: boolean; stopDuringSpawn?: boolean } = {}) {
  let n = 0
  const box = { usage: undefined as Usage | undefined }
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.focus', async () => ({ value: {} }) as any)
  on('ui.panes', async () => ({ value: [{ id: 'agent-office', title: 'Office Agent Monitor', isPlaced: true }] }) as any)
  on('clock.sleep', async (_$: any, e: any) => { await new Promise<void>(r => (globalThis as any).setTimeout(r, e.ms)); return { value: undefined } })
  on('ui.status', async () => ({ value: {} }) as any)
  on('session.cwd', async () => ({ value: '/work/meuapp' }))
  on('session.id', async () => ({ value: 'abcdef123' }))
  on('agent.spawn', async () => {
    const agentId = `ag-${++n}`
    if (o.stopDuringSpawn) await $.classic.SubagentStop({ agent_id: agentId } as any) // fast agent: stops before the spawn resolves
    return { model: 'haiku', ...(o.noAgentId ? {} : { agentId }) } as any
  })
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: box.usage } as any })
  on('tool.call', async () => ({ result: { stdout: 'ok', stderr: '' } }) as any)
  on('classic.SubagentStop', async () => ({}) as any)
  if (o.process) on('process.run', async (_$: any, e: any) => ({ value: o.process!(e.argv, e.cwd) }) as any)
  if (o.usd !== undefined) on('session.usage', async () => ({ value: { startedAt: 0, cost: { usd: o.usd } } }) as any)
  return box
}
const spawn = ($: any, id: string, description: string, extra: Record<string, unknown> = {}) =>
  $.agent.spawn({ tool_use_id: id, prompt: 'p', description, ...extra } as any)
const texts = async (ui: any): Promise<string> => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text ?? '').join('\n')
// turn.step streams: it only runs when drained
const step = async ($: any, e: Record<string, unknown>) => { for await (const _ of $.turn.step({ model: 'claude-haiku-5-5', ...e } as any)) void _ }
const press = async ($: any, ui: any, key: string) => { await ui.press({ key }); await ui.unmount(); return mount($) }
const start = async ($: any, view = 'compact') => {
  await $.command.run({ command: 'office', args: 'start' } as any)
  await $.command.run({ command: 'office', args: `view ${view}` } as any)
}


const wheel = ($: any, by: number) =>
  $.ui.scroll({ component: 'Pane', requestId: 'agent-office', offset: 0, by, bodyRows: 20, contentRows: 40, origin: { kind: 'person' } } as any)
const scrolledUp = (out: string) => /↑ \d+ mais|↑ mais/.test(out) // the up note shows only once the window left the top
const seed = async ($: any, on: any, mode: string, n = 30) => {
  setup($, on)
  await start($, mode === 'map' ? 'map' : 'compact')
  await $.command.run({ command: 'office', args: `mode ${mode}` } as any)
  for (let i = 0; i < n; i++) await spawn($, `tu${i}`, `Dev: n${i}`, { workflow: { runId: `wf${i}`, agentIndex: 1 } })
}
const shot = async ($: any) => { const ui = await mount($, 120, 20); const t = await texts(ui); await ui.unmount(); return t }

for (const mode of ['map', 'tree', 'cards', 'waterfall', 'cost', 'workflow']) { // grouped and tools need git/tool data to overflow: their window is covered by scroll-all-tabs.test.ts and shares this dispatch
  test(`${mode}: wheel down scrolls the tab, wheel up brings it back`, async ($, on) => {
    await seed($, on, mode)
    expect(scrolledUp(await shot($))).toBe(false)
    await wheel($, 5)
    expect(scrolledUp(await shot($))).toBe(true)
    await wheel($, -5)
    expect(scrolledUp(await shot($))).toBe(false)
  })
}

test('wheel ticks are ignored while a search is being typed', async ($, on) => {
  await seed($, on, 'tree')
  let ui = await mount($, 120, 20)
  await ui.press({ key: 'h-s' }).catch(() => undefined) // s opens the search
  await ui.unmount()
  await wheel($, 5)
  expect(scrolledUp(await shot($))).toBe(false)
})
