import { test, expect } from 'claude-code/testing'

// T-005: the REAL Ink render of the detail (terminal, compact view), not detailScreen in isolation.
const mount = ($: any, cols: number, surface = 'terminal') => $.ui.mount({
  plugin: 'agent-office', surface, component: 'Pane', requestId: 'agent-office',
  props: { bodyColumns: cols, bodyRows: 60 } as any, viewport: { columns: cols, rows: 60 } as any,
})
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
  on('clock.after', () => new Promise(() => {}) as any)
  on('session.cwd', async () => ({ value: '/work/meuapp' }))
  on('session.id', async () => ({ value: 'abcdef123' }))
  on('agent.spawn', async () => ({ model: 'haiku', agentId: `ag-${++n}` }) as any)
  on('classic.SubagentStop', async () => ({}) as any)
}
const detailFrame = async ($: any, on: any, cols: number, viewName = 'compact', surface = 'terminal'): Promise<string> => {
  setup($, on)
  await $.session.start({ cwd: '/work/meuapp', surface, isInteractive: true } as any)
  if (surface === 'terminal') await $.command.run({ command: 'office', args: `view ${viewName}` } as any)
  const prompt = 'Investigar por que o carrinho perde itens quando o usuario troca de aba durante o checkout e propor uma correcao completa'
  for (let i = 1; i <= 3; i++) await $.agent.spawn({ tool_use_id: `t${i}`, prompt, description: `QA: teste ${i}` } as any)
  let ui = await mount($, cols, surface)
  const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key ?? ''))
    const key = keys.find((k: string) => k.startsWith('n-t2-')) ?? keys.find((k: string) => k.startsWith('app-open-'))!
  await ui.press({ key })
  await ui.unmount(); ui = await mount($, cols, surface)
  const btns = (await ui.findAll({ type: 'Button' })).map((b: any) => `BTN ${String(b.text)}`)
  return [...(await rowsOf(ui)), ...btns].join('\n')
}

for (const [cols, viewName, surface] of [[80, 'compact', 'terminal'], [120, 'compact', 'terminal'], [80, 'map', 'desktop']] as const) {
  test(`T-005 real detail ${surface} ${cols} cols: one [← voltar], no "_" line, Irmãos label first, prompt by word, no j:/k: orphan`, async ($, on) => {
    const out = await detailFrame($, on, cols, viewName, surface)
        expect(out.split('\n').filter(l => l.startsWith('BTN ') && /voltar/i.test(l) && l.includes('←'))).toHaveLength(1)
    expect(out).not.toMatch(/\[ ?\[/)
    expect(out).not.toMatch(/b voltar|b: voltar|Voltar ao mapa/)
    const lines = out.split('\n')
    expect(lines.some(l => /^[\s_]*_[\s_]*$/.test(l))).toBe(false)
    expect(lines.some(l => /^\s*[jk]:\s*$/.test(l))).toBe(false)
    const i = lines.findIndex(l => l.includes('Irmãos'))
    expect(i).toBeGreaterThanOrEqual(0)
    expect(lines[i]!.trimStart().startsWith('Irmãos')).toBe(true)
    expect(lines.slice(0, i).some(l => /teste \d/.test(l) && !l.includes('Office ›'))).toBe(false)
    const words = new Set('Investigar por que o carrinho perde itens quando o usuario troca de aba durante o checkout e propor uma correcao completa'.split(' '))
    const s = lines.findIndex(l => l.includes('SOLICITAÇÃO'))
    for (const l of lines.slice(s + 1, s + 4)) for (const w of l.trim().replace(/ …$/, '').split(/\s+/).filter(Boolean)) expect(words.has(w)).toBe(true)
  })
}
