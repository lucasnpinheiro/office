import { test, expect } from 'claude-code/testing'

for (const [cols, rows] of [[60, 30], [120, 60], [200, 20]] as const) {
  test(`pane draws the monitor header at ${cols}x${rows}`, async ($, on) => {
    on('ui.open', async () => ({ value: { isPlaced: true } }))
    on('session.cwd', async () => ({ value: '/work/meuapp' }))
    on('session.id', async () => ({ value: 'abcdef123' }))
    await $.command.run({ command: 'office', args: 'start' } as any)
    const ui = await $.ui.mount({
      plugin: 'agent-office', surface: 'terminal', component: 'Pane', requestId: 'agent-office',
      props: { bodyColumns: cols, bodyRows: rows } as any,
      viewport: { columns: cols, rows } as any,
    })
    expect(await ui.find({ type: 'Text', text: /Office/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Níveis de profundidade: 0\/10/ })).toBeDefined()
    await ui.unmount()
  })
}
