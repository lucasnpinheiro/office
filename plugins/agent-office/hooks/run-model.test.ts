import { test, expect } from 'claude-code/testing'
import { buildRunModel, buildGraph, progressOf, overallProgress, durationOf, elapsedOf, etaOf, hiddenIds, maxDepthOf, nextState } from './run-model'
import type { RunState, LifeEvent } from './run-model'
import * as monitor from './monitor'
import type { AgentRecord } from './office'
import type { Capabilities } from './capabilities'
import * as runModel from './run-model'

const T0 = 1_700_000_000_000
const D = '🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo'
const mk = (id: string, over: Partial<AgentRecord> = {}): AgentRecord => ({
  id, agentId: `g-${id}`, description: `${D}: tarefa ${id}`, status: 'working', startedAt: T0, ...over,
})
const caps = {} as Capabilities

// AC-004 / I-004 / U-001
test('buildRunModel é determinístico para a mesma entrada', () => {
  const agents = [mk('a'), mk('b', { parentAgentId: 'g-a' }), mk('c', { parentAgentId: 'g-a', status: 'done', endedAt: T0 + 3000 })]
  const a = buildRunModel(agents, T0 + 5000, caps)
  const b = buildRunModel(agents, T0 + 5000, caps)
  expect(a).toEqual(b)
  expect(a.roots).toEqual(['a'])
  expect(a.nodes.find(n => n.id === 'b')?.parentId).toBe('a')
  expect(a.nodes.find(n => n.id === 'c')?.state).toBe('done')
  expect(a.nodes.find(n => n.id === 'a')?.state).toBe('running')
  expect(a.totals).toMatchObject({ running: 2, done: 1, of: 3 })
})

test('monitor reexporta o mesmo grafo do run-model (uma fonte)', () => {
  expect(monitor.buildGraph).toBe(buildGraph)
})

test('run-model é puro: mesma entrada, mesma saída com Date.now diferente; entrada não é mutada', () => {
  const agents = [
    mk('a', { todos: [{ content: 't1', status: 'completed' }, { content: 't2', status: 'pending' }] } as Partial<AgentRecord>),
    mk('b', { parentAgentId: 'g-a', status: 'done', endedAt: T0 + 2000 }),
    mk('c', { parentAgentId: 'g-a', status: 'done', endedAt: T0 + 4000 }),
    mk('d', { parentAgentId: 'g-a' }),
  ]
  const frozen = structuredClone(agents)
  const RealDate = Date
  const fakeClock = (at: number) => {
    // Date.now is read-only in the sandbox: swap the whole global, restored in finally
    globalThis.Date = class extends RealDate {
      constructor(...a: unknown[]) { a.length ? super(...(a as [number])) : super(at) }
      static now() { return at }
    } as DateConstructor
  }
  const run = () => {
    const m = buildRunModel(agents, T0 + 9000, caps)
    const g = buildGraph(agents, T0 + 9000)
    return {
      m,
      progress: [...g.nodes.values()].map(n => [n.id, progressOf(n)]),
      overall: overallProgress(g),
      durations: [...g.nodes.values()].map(n => durationOf(n, T0 + 9000)),
      elapsed: elapsedOf(g, T0 + 9000), eta: etaOf(g), hidden: [...hiddenIds(g, T0 + 9000)], depth: maxDepthOf(g),
    }
  }
  try {
    fakeClock(1)
    expect(Date.now()).toBe(1)
    const first = run()
    fakeClock(9_999_999_999_999)
    expect(Date.now()).toBe(9_999_999_999_999)
    const second = run()
    expect(second).toEqual(first)
  } finally { globalThis.Date = RealDate }
  expect(agents).toEqual(frozen)
})

test('60 agentes encadeados montam 60 nós e uma raiz', () => {
  const agents = Array.from({ length: 60 }, (_, i) => mk(`n${i}`, i ? { parentAgentId: `g-n${i - 1}` } : {}))
  const m = buildRunModel(agents, T0 + 5000, caps)
  expect(m.nodes).toHaveLength(60)
  expect(m.roots).toEqual(['n0'])
})

test('attention lista needs-you, stalled e failed', () => {
  const stale = mk('s', { seenAt: T0, startedAt: T0 })
  const bad = mk('f', { status: 'error', error: 'boom', endedAt: T0 + 1 })
  const ok = mk('k', { seenAt: T0 + 20 * 60 * 1000 })
  const m = buildRunModel([stale, bad, ok], T0 + 20 * 60 * 1000, caps)
  expect(m.nodes.find(n => n.id === 's')?.state).toBe('stalled')
  expect(m.attention.sort()).toEqual(['f', 's'])
})

// AC-005 / I-005 / U-002
test('pai ausente da lista vira raiz sem perder o agente e seus filhos', () => {
  const m = buildRunModel([mk('x', { parentAgentId: 'g-gone' }), mk('y', { parentAgentId: 'g-x' })], T0 + 1000, caps)
  expect(m.roots).toEqual(['x'])
  expect(m.nodes.map(n => n.id).sort()).toEqual(['x', 'y'])
  expect(m.nodes.find(n => n.id === 'y')?.parentId).toBe('x')
})

// AC-006 / I-006 / U-003
test('horário inválido mantém o nó com tempo indefinido e não lança', () => {
  const m = buildRunModel([mk('z', { startedAt: Number.NaN })], T0, caps)
  const z = m.nodes.find(n => n.id === 'z')
  expect(z).toBeDefined()
  expect(z?.startedAt).toBeUndefined()
})

test('startedAt inválido não gera NaN no início da raiz do grafo legado', () => {
  const g = buildGraph([mk('z', { startedAt: Number.NaN }), mk('w', { startedAt: T0 + 10 })], T0 + 100)
  expect(Number.isNaN(g.root.start)).toBe(false)
  expect(g.root.start).toBe(T0 + 10)
  const only = buildGraph([mk('z', { startedAt: Number.NaN })], T0 + 100)
  expect(only.root.start).toBeUndefined()
})

// Comportamento atual do buildGraph (resolve o pai em ordem de spawn). Mudar para ordem livre altera o grafo
// das views existentes: decisão pendente do dono, ver relatório de T-002.
test('filho listado antes do pai: ninguém some; o filho vira raiz (ordem de spawn é o contrato atual)', () => {
  const m = buildRunModel([mk('child', { parentAgentId: 'g-parent' }), mk('parent')], T0 + 1000, caps)
  expect(m.nodes.map(n => n.id).sort()).toEqual(['child', 'parent'])
  expect(m.roots.sort()).toEqual(['child', 'parent'])
})

test('tipos de capacidade vêm de capabilities.ts (uma fonte)', () => {
  const c: runModel.Capabilities = {} as Capabilities
  expect(c).toBeDefined()
})

test('T-008 buildRunModel: workflows agrupados por runId na ordem do agentIndex, sem fases nem rodada', () => {
  const wf = (id: string, runId: string, agentIndex: number) => mk(id, { workflow: { runId, agentIndex } })
  const m = buildRunModel([wf('b', 'wf_1', 2), wf('a', 'wf_1', 1), wf('c', 'wf_2', 1), mk('solto')], T0 + 1, caps)
  expect(m.workflows).toEqual([{ runId: 'wf_1', agentIds: ['a', 'b'] }, { runId: 'wf_2', agentIds: ['c'] }])
  expect(JSON.stringify(m)).not.toMatch(/phases|round/)
  expect(buildRunModel([mk('solto')], T0 + 1, caps).workflows).toBeUndefined()
})

// T-009 etaOf honesto: só o mesmo modelo, sem tarefa, sem dupla contagem, paralelismo observado
const S = '🛠️ Mid-level · 🎼 Sonnet · 🟢 baixo'
const H = '🛠️ Mid-level · 🪶 Haiku · 🟢 baixo'
const done = (id: string, from: number, to: number, desc = S): AgentRecord => mk(id, { description: `${desc}: ${id}`, status: 'done', startedAt: T0 + from, endedAt: T0 + to })
const run = (id: string, desc = S, over: Partial<AgentRecord> = {}): AgentRecord => mk(id, { description: `${desc}: ${id}`, ...over })

test('ETA: só do mesmo modelo conta; qualquer agente aberto de outro modelo ou sem modelo = sem previsão (achado PR 19)', () => {
  const samples = [done('a', 0, 60_000), done('b', 100_000, 160_000), done('c', 200_000, 260_000)]
  expect(etaOf(buildGraph([...samples, run('s1')], T0 + 300_000))).toBe(60_000) // 1 Sonnet restante, sequencial (amostras sem sobreposição)
  expect(etaOf(buildGraph([...samples, run('s1'), run('h1', H), run('h2', H)], T0 + 300_000))).toBeUndefined() // mistura: Haiku aberto
  expect(etaOf(buildGraph([...samples, run('s1'), mk('u', { description: 'sem persona' })], T0 + 300_000))).toBeUndefined() // modelo desconhecido aberto
  const open = (st: 'pending' | 'running') => mk('h', { description: `${H}: h`, active: st === 'running' ? undefined : false })
  expect(etaOf(buildGraph([...samples, run('s1'), open('pending')], T0 + 300_000))).toBeUndefined()
})

test('ETA: só agentes de outro modelo restando = nada a prever', () => {
  const ag = [done('a', 0, 60_000), done('b', 100_000, 160_000), done('c', 200_000, 260_000), run('h1', H)]
  expect(etaOf(buildGraph(ag, T0 + 300_000))).toBeUndefined()
})

test('ETA: tarefas (TodoWrite) não contam como trabalho restante', () => {
  const ag = [done('a', 0, 60_000), done('b', 100_000, 160_000), done('c', 200_000, 260_000), run('s1', S, { todos: [{ content: 't1', status: 'pending' }, { content: 't2', status: 'pending' }, { content: 't3', status: 'in_progress' }] })]
  expect(etaOf(buildGraph(ag, T0 + 300_000))).toBe(60_000)
})

test('ETA: pai rodando com filho rodando não conta duas vezes', () => {
  const ag = [done('a', 0, 60_000), done('b', 100_000, 160_000), done('c', 200_000, 260_000), run('p'), run('k', S, { parentAgentId: 'g-p' })]
  expect(etaOf(buildGraph(ag, T0 + 300_000))).toBe(60_000)
})

test('ETA: paralelismo observado nas amostras divide o restante (3 simultâneas, 6 restantes = 2 rodadas)', () => {
  const ag = [done('a', 0, 60_000), done('b', 0, 60_000), done('c', 0, 60_000), ...['1', '2', '3', '4', '5', '6'].map(i => run(`s${i}`))]
  expect(etaOf(buildGraph(ag, T0 + 70_000))).toBe(120_000)
})

test('ETA: amostras sem sobreposição = sequencial, nunca promete paralelismo', () => {
  const ag = [done('a', 0, 60_000), done('b', 60_000, 120_000), done('c', 120_000, 180_000), run('s1'), run('s2')]
  expect(etaOf(buildGraph(ag, T0 + 190_000))).toBe(120_000)
})

test('ETA: modelo desconhecido nunca vira "mesmo modelo"', () => {
  const nm = (id: string, from: number, to: number): AgentRecord => mk(id, { description: 'sem persona', status: 'done', startedAt: T0 + from, endedAt: T0 + to })
  const ag = [nm('a', 0, 60_000), nm('b', 100_000, 160_000), nm('c', 200_000, 260_000), mk('d', { description: 'sem persona' })]
  expect(etaOf(buildGraph(ag, T0 + 300_000))).toBeUndefined()
})

// flow-rules §3: "Parado sem sinal" only from Rodando; a queued agent (active false) never stalls
test('agente na fila não vira parado sem sinal, mesmo sem atividade há 10 min', () => {
  const m = buildRunModel([mk('q', { active: false, seenAt: T0 })], T0 + 11 * 60 * 1000, caps)
  expect(m.nodes.find(n => n.id === 'q')?.state).toBe('queued')
  expect(m.attention).toEqual([])
})

// flow-rules §3: every lifecycle arrow exists in the pure reducer; any other event leaves the state unchanged
test('nextState: cada seta do ciclo de vida existe e o resto fica', () => {
  const cases: [RunState, LifeEvent, RunState][] = [
    ['queued', 'tool', 'running'], ['running', 'finish', 'done'], ['running', 'error', 'failed'],
    ['failed', 'retry', 'running'], ['running', 'stop', 'stopped'], ['running', 'permission', 'needs-you'],
    ['needs-you', 'answer', 'running'], ['needs-you', 'pause', 'paused'], ['paused', 'resume', 'running'],
    ['running', 'stall', 'stalled'], ['stalled', 'tool', 'running'],
    ['stalled', 'finish', 'done'], ['stalled', 'error', 'failed'], ['stalled', 'stop', 'stopped'],
  ]
  for (const [s, e, to] of cases) expect(nextState(s, e)).toBe(to)
  expect(nextState('queued', 'stall')).toBe('queued') // parado sem sinal vale só a partir de Rodando
  expect(nextState('paused', 'stall')).toBe('paused')
  expect(nextState('done', 'tool')).toBe('done') // final: nenhuma atividade o tira do estado
  expect(nextState('stopped', 'retry')).toBe('stopped')
  expect(nextState('done', 'retry')).toBe('done') // repetir só sai de Falhou
})
