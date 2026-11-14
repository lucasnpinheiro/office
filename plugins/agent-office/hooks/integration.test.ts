import { test, expect } from 'claude-code/testing'
import { GIT_SAFE_PREFIX } from './git'

// Register-level integration (T-007 a T-010): drives the real register.tsx through the engine test kit and reads
// what the pane draws (renderCompact via ui.render), not a view in isolation.
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

test('T-008 id: dois agentes de workflow com o mesmo tool_use_id viram dois cards, sem fusão', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'toolu_wf', 'Dev: alfa', { workflow: { runId: 'wf_abc', agentIndex: 1 } })
  await spawn($, 'toolu_wf', 'Dev: beta', { workflow: { runId: 'wf_abc', agentIndex: 2 } })
  await $.command.run({ command: 'office', args: 'mode workflow' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect((out.match(/Dev: alfa|alfa/g) ?? []).length).toBe(1)
  expect((out.match(/beta/g) ?? []).length).toBe(1)
  expect(out).toContain('wf_abc')
  expect(out).toContain('0/2 agentes')
  expect(out).toContain('Fases: indisponíveis')
  expect(out).not.toMatch(/Rodada|Planejar/)
  await ui.unmount()
})

test('T-008 sem workflow: a visão diz que não há e g não passa por ela', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  await $.command.run({ command: 'office', args: 'mode workflow' } as any)
  let ui = await mount($)
  expect(await texts(ui)).toContain('Nenhum workflow nesta sessão')
  // ciclo g sem workflow: cards -> waterfall -> cost -> tools -> tree (workflow pulado)
  await $.command.run({ command: 'office', args: 'mode tools' } as any)
  await ui.unmount(); ui = await mount($)
  ui = await press($, ui, 'h-g')
  const out = await texts(ui)
  expect(out).not.toContain('Nenhum workflow nesta sessão')
  expect(out).toContain('Níveis de profundidade') // árvore
  await ui.unmount()
})

test('T-008 com workflow: g chega à visão Workflow depois de Ferramentas', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'toolu_wf', 'Dev: alfa', { workflow: { runId: 'wf_abc', agentIndex: 1 } })
  await $.command.run({ command: 'office', args: 'mode tools' } as any)
  let ui = await mount($)
  ui = await press($, ui, 'h-g')
  expect(await texts(ui)).toContain('wf_abc')
  await ui.unmount()
})

test('T-010 g alcança Custo e Ferramentas; tokens por agente + sessão, parcial, sem ~$ inventado', async ($, on) => {
  const box = setup($, on)
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  await spawn($, 'tu2', 'Dev: beta')
  box.usage = USAGE(1000)
  await step($, { agentId: 'ag-1' }) // alfa: 1000
  box.usage = USAGE(500)
  await step($, {}) // sessão principal: 500; beta sem dado
  await $.command.run({ command: 'office', args: 'mode waterfall' } as any)
  let ui = await mount($)
  ui = await press($, ui, 'h-g') // waterfall -> cost
  const cost = await texts(ui)
  expect(cost).toContain('Custo ~$ —')
  expect(cost).toContain('1,5k parcial tokens') // 1000 do alfa + 500 da sessão, beta desconhecido
  expect(cost).toContain('~$ —')
  expect(cost).not.toMatch(/~\$\s*\d/)
  ui = await press($, ui, 'h-g') // cost -> tools
  expect(await texts(ui)).toContain('Ferramentas · 0 chamadas')
  await ui.unmount()
})

test('T-010 Ferramentas: contagem por ferramenta e entrada/saída mascaradas só com OFFICE_CAPTURE_IO=1', async ($, on) => {
  setup($, on)
  on('env.get', async (_$: any, e: any) => ({ value: e.name === 'OFFICE_CAPTURE_IO' ? '1' : undefined }) as any)
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  await $.tool.call({ tool: 'Bash', tool_use_id: 'tc1', agentId: 'ag-1', command: 'echo token=abc123secretvalue' } as any).catch(() => undefined)
  await $.command.run({ command: 'office', args: 'mode tools' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('Ferramentas · 1 chamadas')
  expect(out).toContain('Bash ×1')
  expect(out).not.toContain('abc123secretvalue')
  await ui.unmount()
})

test('T-010 cabeçalho: tokens com parcial, sem leitura morta de usage e sem custo inventado', async ($, on) => {
  const box = setup($, on)
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  box.usage = USAGE(12_300)
  await step($, { agentId: 'ag-1' })
  await $.command.run({ command: 'office', args: 'mode tree' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('tokens 12,3 mil parcial') // sem tokens da sessão: parcial
  expect(out).not.toMatch(/custo/i)
  await ui.unmount()
})

test('T-009 detalhe: ordem do Padrão, nota de captura desligada, e o segredo nunca aparece', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'tu1', '🛠️ Mid-level · 🪶 Haiku · 🟢 baixo: Dev token=abc123secretvalue', { prompt: 'faça isto com password=hunter2xyz' })
  await $.command.run({ command: 'office', args: 'open tu1' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  const order = ['Linha do tempo', 'Prompt · segredos mascarados', 'Dependências']
  const pos = order.map(k => out.indexOf(k))
  expect(pos.every(p => p >= 0)).toBe(true)
  expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  expect(out).toContain('OFFICE_CAPTURE_IO=1')
  expect(out).not.toContain('abc123secretvalue')
  expect(out).not.toContain('hunter2xyz')
  await ui.unmount()
})

test('T-009 detalhe do mapa também usa a tela nova (mesma ordem)', async ($, on) => {
  setup($, on)
  await start($, 'map')
  await spawn($, 'tu1', 'Dev: alfa')
  await $.command.run({ command: 'office', args: 'open tu1' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('Linha do tempo')
  expect(out).toContain('Dependências')
  await ui.unmount()
})

test('T-009 agente selecionado sumiu: volta à lista com aviso', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  await $.command.run({ command: 'office', args: 'open fantasma' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('O agente saiu da lista')
  expect(out).toContain('alfa')
  await ui.unmount()
})

test('T-009 ETA: 3 concluídos de um modelo e só outro modelo rodando = ETA calculando', async ($, on) => {
  setup($, on)
  await start($)
  const S = '🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo'
  const H = '🛠️ Mid-level · 🪶 Haiku · 🟢 baixo'
  for (const i of ['a', 'b', 'c']) {
    await spawn($, `d${i}`, `${S}: ${i}`)
    await $.classic.SubagentStop({ agent_id: `ag-${['a', 'b', 'c'].indexOf(i) + 1}` } as any)
  }
  await spawn($, 'h1', `${H}: rodando`)
  await $.command.run({ command: 'office', args: 'mode tree' } as any)
  const ui = await mount($)
  expect(await texts(ui)).toContain('ETA calculando')
  await ui.unmount()
})

test('T-007 grupos: cada agente uma só vez, sob o divisor do seu worktree; agente sem git continua visível', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'w1', 'Dev: alfa', { cwd: '/repo/.claude/worktrees/agent-aa' })
  await spawn($, 'w2', 'Dev: beta', { cwd: '/repo/.claude/worktrees/agent-bb' })
  await spawn($, 'w3', 'Dev: gama', { cwd: '/repo/.claude/worktrees/agent-aa' })
  await spawn($, 'w4', 'Dev: sem git', { cwd: '/nao/existe' })
  await $.classic.SubagentStop({ agent_id: 'ag-3' } as any) // gama termina: estados diferentes não colapsam em `×N`
  await $.command.run({ command: 'office', args: 'mode grouped' } as any)
  const ui = await mount($)
  const rows = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text ?? '')
  const idx = (re: RegExp) => rows.findIndex((r: string) => re.test(r))
  for (const n of ['alfa', 'beta', 'gama', 'sem git']) expect([n, rows.filter((r: string) => r.includes(n)).length]).toEqual([n, 1])
  // alfa e gama estão sob o divisor de agent-aa; beta sob o de agent-bb
  const dAA = idx(/worktree.*agent-aa|agent-aa/), dBB = idx(/agent-bb/)
  expect(dAA).toBeGreaterThanOrEqual(0)
  expect(dBB).toBeGreaterThanOrEqual(0)
  const first = idx(/alfa/), third = idx(/gama/), second = idx(/beta/)
  const lo = Math.min(dAA, dBB)
  expect(first).toBeGreaterThan(dAA)
  expect(third).toBeGreaterThan(dAA)
  expect(second).toBeGreaterThan(dBB)
  void lo
  await ui.unmount()
})

// ---- T-007 AC-023: `+N commits` só com $.process provado, em segundo plano, 30 s de cache ----
const WT = '/work/meuapp/.claude/worktrees/agent-aa' // sob o cwd da sessão (setup): o git só roda aí
const tick = () => new Promise(r => setTimeout(r, 30))
const okRun = (calls: string[]) => (argv: readonly string[]) => {
  const k = argv.slice(GIT_SAFE_PREFIX.length).join(' ')
  calls.push(k)
  if (k.includes('@{upstream}')) return { exitCode: 0, stdout: 'origin/main\n', stderr: '' }
  if (k.startsWith('rev-list --count')) return { exitCode: 0, stdout: '4\n', stderr: '' }
  return { exitCode: 128, stdout: '', stderr: 'fatal' }
}

test('T-007 worktrees: base real e +N commits aparecem depois da contagem em segundo plano e vêm do cache por 30 s', async ($, on) => {
  const calls: string[] = []
  setup($, on, { process: okRun(calls) })
  await start($)
  await spawn($, 'w1', 'Dev: alfa', { cwd: WT })
  await $.command.run({ command: 'office', args: 'mode grouped' } as any)
  let ui = await mount($)
  await tick()
  await ui.unmount(); ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('base origin/main +4 commits')
  expect(out).not.toContain('+0')
  expect(out).not.toContain('base agent-aa') // nunca a própria branch como base
  const n = calls.length
  await ui.unmount(); ui = await mount($); await tick()
  expect(calls.length).toBe(n) // cache de 30 s: nenhuma chamada nova
  await ui.unmount()
})

test('T-007 segurança: worktree fora do repo da sessão nunca roda git (cwd é do agente)', async ($, on) => {
  const calls: string[] = []
  setup($, on, { process: okRun(calls) })
  await start($)
  await spawn($, 'w1', 'Dev: alfa', { cwd: '/evil/.claude/worktrees/agent-aa' })
  await $.command.run({ command: 'office', args: 'mode grouped' } as any)
  let ui = await mount($)
  await tick(); await ui.unmount(); ui = await mount($)
  expect(calls.length).toBe(0)
  expect(await texts(ui)).not.toMatch(/commits/)
  await ui.unmount()
})

test('T-007 worktrees: git que falha, ou $.process ausente, omite a contagem (nunca zero)', async ($, on) => {
  setup($, on, { process: () => ({ exitCode: 128, stdout: '', stderr: 'fatal' }) })
  await start($)
  await spawn($, 'w1', 'Dev: alfa', { cwd: WT })
  await $.command.run({ command: 'office', args: 'mode grouped' } as any)
  let ui = await mount($)
  await tick(); await ui.unmount(); ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('agent-aa')
  expect(out).not.toMatch(/commits|\+0/)
  await ui.unmount()
})

test('T-007 worktrees: sem $.process (app) não há contagem e o painel segue', async ($, on) => {
  setup($, on) // nenhum on('process.run'): $.process.run rejeita
  await start($)
  await spawn($, 'w1', 'Dev: alfa', { cwd: WT })
  await $.command.run({ command: 'office', args: 'mode grouped' } as any)
  let ui = await mount($)
  await tick(); await ui.unmount(); ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('Dev: alfa')
  expect(out).not.toContain('commits')
  await ui.unmount()
})

// ---- T-010 item 7: USD da sessão só quando o engine entrega (`$.session.usage().cost.usd`) ----
test('T-010 cabeçalho e Custo mostram o USD da sessão só quando o engine o entrega', async ($, on) => {
  const box = setup($, on, { usd: 0.0523 })
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  box.usage = USAGE(500)
  await step($, {}) // passo da sessão principal: lê o custo em segundo plano
  await tick()
  await $.command.run({ command: 'office', args: 'mode tree' } as any)
  let ui = await mount($)
  expect(await texts(ui)).toContain('~$0,05')
  await ui.unmount()
  await $.command.run({ command: 'office', args: 'mode cost' } as any)
  ui = await mount($)
  expect(await texts(ui)).toContain('Custo ~$0,05')
  await ui.unmount()
})

test('T-009 selecionado sumiu: o botão voltar limpa o aviso', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'tu1', 'Dev: alfa')
  await $.command.run({ command: 'office', args: 'open fantasma' } as any)
  let ui = await mount($)
  expect(await texts(ui)).toContain('O agente saiu da lista')
  await ui.press({ key: 'office-back' })
  await ui.unmount(); ui = await mount($)
  expect(await texts(ui)).not.toContain('O agente saiu da lista')
  await ui.unmount()
})

// ---- achado PR 19: agentes de workflow não ficam "ativos" para sempre ----
// Probe 2026-11-05 (claude -p --plugin-dir): o agent.spawn de um agente de workflow devolve agentId e o SubagentStop traz o
// mesmo agent_id (agent_type workflow-subagent), então a conclusão casa. Sem agentId não há como casar: fim desconhecido.
test('workflow: SubagentStop com o agent_id do spawn conclui o agente (probe)', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'toolu_wf', 'Dev: alfa', { workflow: { runId: 'wf_abc', agentIndex: 1 } })
  await $.classic.SubagentStop({ agent_id: 'ag-1' } as any)
  await $.command.run({ command: 'office', args: 'mode workflow' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('✓ Dev: alfa')
  await ui.unmount()
})

test('workflow: sem agentId não dá para casar o fim; o agente fica com fim desconhecido, nunca ativo nem parado sem sinal', async ($, on) => {
  setup($, on, { noAgentId: true })
  await start($)
  await spawn($, 'toolu_wf', 'Dev: alfa', { workflow: { runId: 'wf_abc', agentIndex: 1 } })
  await $.command.run({ command: 'office', args: 'mode workflow' } as any)
  const ui = await mount($)
  const out = await texts(ui)
  expect(out).toContain('■ Dev: alfa')
  expect(out).toContain('0 rodando')
  await ui.unmount()
})

test('workflow: SubagentStop que chega antes de o spawn devolver o agentId também conclui o agente', async ($, on) => {
  setup($, on, { stopDuringSpawn: true })
  await start($)
  await spawn($, 'toolu_wf', 'Dev: alfa', { workflow: { runId: 'wf_abc', agentIndex: 1 } })
  await $.command.run({ command: 'office', args: 'mode workflow' } as any)
  const ui = await mount($)
  expect(await texts(ui)).toContain('✓ Dev: alfa')
  await ui.unmount()
})

const mountOn = ($: any, surface: string) =>
  $.ui.mount({ plugin: 'agent-office', surface, component: 'Pane', requestId: 'agent-office',
    props: { bodyColumns: 120, bodyRows: 80 } as any, viewport: { columns: 120, rows: 80 } as any })

test('app surface: cards viram Box/Text gráficos com chips, sem caixa de texto; terminal mantém a caixa', async ($, on) => {
  setup($, on)
  await start($)
  await spawn($, 'tu1', '🛠️ Mid-level · 🎼 Sonnet · 🟡 médio: Reading edit.php')
  const app = await mountOn($, 'desktop')
  const a = await texts(app)
  expect(a).toContain('Reading edit.php'); expect(a).toContain('🛠️ Mid-level'); expect(a).toContain('🎼 Sonnet'); expect(a).toContain('🟡 médio')
  expect(a).not.toMatch(/[╭╮╰╯│]/)
  await app.unmount()
  const term = await texts(await mountOn($, 'terminal'))
  expect(term).toMatch(/[╭╮╰╯]/)
})
