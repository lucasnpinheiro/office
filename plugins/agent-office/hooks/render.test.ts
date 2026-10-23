import { test, expect } from 'claude-code/testing'

for (const [cols, rows] of [[60, 30], [120, 60], [200, 20]] as const) {
  test(`pane draws the monitor header at ${cols}x${rows}`, async ($, on) => {
    on('ui.open', async () => ({ value: { isPlaced: true } }))
    on('session.cwd', async () => ({ value: '/work/meuapp' }))
    on('session.id', async () => ({ value: 'abcdef123' }))
    await $.command.run({ command: 'office', args: 'start' } as any)
    await $.command.run({ command: 'office', args: 'view compact' } as any)
    const ui = await $.ui.mount({
      plugin: 'agent-office', surface: 'terminal', component: 'Pane', requestId: 'agent-office',
      props: { bodyColumns: cols, bodyRows: rows } as any,
      viewport: { columns: cols, rows } as any,
    })
    expect(await ui.find({ type: 'Text', text: /Office/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /rodando/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Níveis de profundidade/ })).toBeUndefined()
    await ui.unmount()
  })
}

test('pane footer has one-letter hotkeys; s opens search and silences them; v toggles map and back', async ($, on) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.focus', async () => ({ value: {} }) as any)
  on('session.cwd', async () => ({ value: '/work/meuapp' }))
  on('session.id', async () => ({ value: 'abcdef123' }))
  await $.command.run({ command: 'office', args: 'start' } as any)
  const mount = () => $.ui.mount({
    plugin: 'agent-office', surface: 'terminal', component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: 120, bodyRows: 40 } as any, viewport: { columns: 120, rows: 40 } as any,
  })
  let ui = await mount()
  // session starts in the map view: only v and q
  expect(await ui.find({ key: 'h-g' })).toBeUndefined()
  expect(await ui.find({ key: 'h-v' })).toBeDefined()
  expect(await ui.find({ key: 'h-q' })).toBeDefined()
  await ui.press({ key: 'h-v' })
  await ui.unmount(); ui = await mount()
  for (const k of ['g', 'o', 'f', 's', 'v', 'q']) expect([k, !!(await ui.find({ key: `h-${k}` }))]).toEqual([k, true])
  await ui.press({ key: 'h-s' })
  await ui.unmount(); ui = await mount()
  expect(["search", !!(await ui.find({ key: "office-search" }))]).toEqual(["search", true])
  expect(await ui.find({ key: 'h-g' })).toBeUndefined()
  await ui.input({ key: 'office-search', text: '' })
  await ui.unmount(); ui = await mount()
  await ui.press({ key: 'h-v' })
  await ui.unmount(); ui = await mount()
  expect(await ui.find({ key: 'h-g' })).toBeUndefined()
  expect(await ui.find({ key: 'h-v' })).toBeDefined()
  await ui.press({ key: 'h-v' })
  await ui.unmount(); ui = await mount()
  expect(await ui.find({ key: 'h-g' })).toBeDefined()
  await ui.unmount()
})
