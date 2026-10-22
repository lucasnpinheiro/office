import { test, expect } from 'claude-code/testing'

const run = ($: any, args: string) => $.command.run({ command: 'office', args })

test('/office star opens, /office stop closes, bare toggles, junk shows help', async ($, on) => {
  const seen: string[] = []
  on('ui.open', async () => { seen.push('open'); return { value: { isPlaced: true } } })
  on('ui.close', async () => { seen.push('close'); return { value: undefined } })

  expect((await run($, 'star')).text).toContain('aberto')
  expect((await run($, 'stop')).text).toContain('fechado')
  expect((await run($, '')).text).toContain('aberto') // closed -> toggle opens
  expect((await run($, '')).text).toContain('fechado') // open -> toggle closes
  expect((await run($, 'banana')).text).toContain('Uso:')
  expect(seen.filter(x => x === 'open').length).toBeGreaterThanOrEqual(2)
  expect(seen.filter(x => x === 'close').length).toBeGreaterThanOrEqual(2)
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
  await new Promise(r => setTimeout(r, 50)) // let background resize/schedule settle before teardown
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
