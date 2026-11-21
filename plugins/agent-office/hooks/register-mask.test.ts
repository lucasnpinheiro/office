import { test, expect } from 'claude-code/testing'
import { MASK } from './mask'

// 0.28.44: the REAL Ink render of register.tsx (detail header `d.name`, branch chip `c.name.slice(0, 14)`).
// A glued secret in the agent name must not reach the rendered rows. Same harness as detail-render.test.ts.
const GH = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const NAME = `deploy_${GH}`
const mount = ($: any, cols: number, surface = 'terminal') => $.ui.mount({
  plugin: 'agent-office', surface, component: 'Pane', requestId: 'agent-office',
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
  on('clock.after', () => new Promise(() => {}) as any)
  on('session.cwd', async () => ({ value: '/work/meuapp' }))
  on('session.id', async () => ({ value: 'abcdef123' }))
  on('agent.spawn', async () => ({ model: 'haiku', agentId: `ag-${++n}` }) as any)
  on('classic.SubagentStop', async () => ({}) as any)
}

for (const [cols, surface] of [[80, 'terminal'], [120, 'terminal'], [80, 'desktop']] as const) {
  test(`0.28.44 register: real ${surface} ${cols} cols masks a glued secret in the agent name (list and detail)`, async ($, on) => {
    setup($, on)
    await $.session.start({ cwd: '/work/meuapp', surface, isInteractive: true } as any)
    if (surface === 'terminal') await $.command.run({ command: 'office', args: 'view compact' } as any)
    const prompt = 'Investigar por que o carrinho perde itens quando o usuario troca de aba durante o checkout'
    await $.agent.spawn({ tool_use_id: 't1', prompt, description: 'QA: teste 1' } as any)
    await $.agent.spawn({ tool_use_id: 't2', prompt, description: `QA: ${NAME}` } as any)
    let ui = await mount($, cols, surface)
    const rows = async (u: any) => (await u.findAll({ type: 'Box' })).filter((b: any) => typeof b.text === 'string').map((b: any) => b.text as string)
    const btns = async (u: any) => (await u.findAll({ type: 'Button' })).map((b: any) => `BTN ${String(b.text)} ${String(b.key ?? '')}`)
    const list = [...(await rows(ui)), ...(await btns(ui))].join('\n')
    expect(list).not.toContain(GH)
    expect(list).not.toContain(GH.slice(0, 10))
    const key = (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key ?? '')).find((k: string) => k.startsWith('n-t2-')) ?? (await ui.findAll({ type: 'Button' })).map((b: any) => String(b.key ?? '')).find((k: string) => k.startsWith('app-open-'))
    if (key) await ui.press({ key })
    await ui.unmount(); ui = await mount($, cols, surface)
    const detail = [...(await rows(ui)), ...(await btns(ui))].join('\n')
    expect(detail).not.toContain(GH)
    expect(detail).not.toContain(GH.slice(0, 10))
    expect(list + detail).toContain(MASK)
  })
}
