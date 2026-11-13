import { test, expect } from 'claude-code/testing'

const run = ($: any, args: string) => $.command.run({ command: 'office', args })

test('/office star opens, /office stop closes, bare toggles, junk shows help', async ($, on) => {
  const seen: string[] = []
  let up = false
  on('ui.open', async () => { seen.push('open'); up = true; return { value: { isPlaced: true } } })
  on('ui.close', async () => { seen.push('close'); up = false; return { value: undefined } })
  on('ui.panes', async () => ({ value: up ? [{ id: 'agent-office', title: 'Office Agent Monitor', isPlaced: true }] : [] }) as any)

  expect((await run($, 'star')).text).toContain('aberto')
  expect((await run($, 'stop')).text).toContain('fechado')
  expect((await run($, '')).text).toContain('aberto') // closed -> toggle opens
  expect((await run($, '')).text).toContain('fechado') // open -> toggle closes
  expect((await run($, 'banana')).text).toContain('Uso:')
  expect(seen.filter(x => x === 'open').length).toBeGreaterThanOrEqual(2)
  expect(seen.filter(x => x === 'close').length).toBeGreaterThanOrEqual(2)
})

test('bare /office opens (with focus) a pane that waits undrawn instead of closing it', async ($, on) => {
  const opens: unknown[] = []
  on('ui.open', async (_$: any, e: any) => { opens.push(e.focus); return { value: { isPlaced: false, reason: 'terminal estreito' } } as any })
  on('ui.close', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [{ id: 'agent-office', title: 'x', isPlaced: false }] }) as any)
  await run($, 'start')
  expect((await run($, 'status')).text).toContain('não desenhado (terminal estreito)')
  expect((await run($, '')).text).toContain('aberto') // undrawn counts as closed: no "fechado"
  expect(opens[opens.length - 1]).toBe(true)
})

test('/office collapse and expand answer', async ($, on) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  await run($, 'start')
  expect((await run($, 'collapse')).text).toContain('recolhidos')
  expect((await run($, 'expand')).text).toContain('expandidos')
})

test('session.start opens the pane on its own, even when isOpen was left false', async ($, on) => {
  const seen: string[] = []
  on('ui.open', async () => { seen.push('open'); return { value: { isPlaced: true } } })
  on('ui.close', async () => { seen.push('close'); return { value: undefined } })
  on('command.register', async () => ({ value: { command: 'office' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await run($, 'stop') // persisted isOpen=false, as left by a previous session exit
  seen.length = 0
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(seen).toContain('open')
  await new Promise(r => (globalThis as any).setTimeout(r, 50)) // let background resize/schedule settle before teardown
})

test('/office status reports state; /office reset refuses while open', async ($, on) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('ui.close', async () => ({ value: undefined }))
  await run($, 'stop')
  expect((await run($, 'status')).text).toContain('aberto: não')
  await run($, 'start')
  expect((await run($, 'reset')).text).toContain('feche')
  await run($, 'stop')
  expect((await run($, 'reset')).text).toContain('resetado')
})

test('help lists the real hotkeys (s buscar, b voltar, p/n irmaos), never / or Esc', async ($, on) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  const t = (await run($, 'banana')).text
  expect(t).toContain('s buscar')
  expect(t).toContain('b voltar')
  expect(t).toContain('p/n')
  expect(t).not.toContain('/ buscar')
  expect(t).not.toContain('Esc')
})

test('subcommand word is case-insensitive for every subcommand (VIEW like STOP)', async ($, on) => {
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  expect((await run($, 'VIEW map')).text).toBe('Visão: map.')
  expect((await run($, 'Mode tree')).text).toBe('Modo: tree.')
})
