import { test, expect } from 'claude-code/testing'
import { pushStep, toolStep, usageOf, addUsage, recordSafely, MAX_STEPS } from './capture'
import { buildRunModel } from './run-model'
import type { AgentRecord } from './office'
import type { Capabilities } from './capabilities'

const T0 = 1_700_000_000_000
const D = '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo'
const mk = (over: Partial<AgentRecord> = {}): AgentRecord => ({
  id: 'a', agentId: 'g-a', description: `${D}: tarefa`, status: 'working', startedAt: T0, ...over,
})
const caps = {} as Capabilities

// AC-007 / S-007 / I-007: one ToolStep per finished call, in start order, with its own duration
test('AC-007: passos de ferramenta ficam na ordem de início, com duração e resultado', () => {
  const read = toolStep('tu1', 'Read', { file_path: '/x/y/Foo.php' }, T0 + 10, 40, {})
  expect(read).toEqual({ id: 'tu1', tool: 'Read', label: 'Read Foo.php', startedAt: T0 + 10, durationMs: 40, ok: true })
  const bash = toolStep('tu2', 'Bash', { command: 'git status' }, T0 + 60, 900, { isError: true })
  expect(bash).toMatchObject({ tool: 'Bash', label: 'git', durationMs: 900, ok: false })
  let a = mk()
  a = pushStep(a, read)
  a = pushStep(a, bash)
  expect(a.steps?.map(s => s.id)).toEqual(['tu1', 'tu2'])
  expect(a.steps?.map(s => s.startedAt)).toEqual([T0 + 10, T0 + 60])
  expect(a.droppedSteps).toBe(0)
  const model = buildRunModel([a], T0 + 1000, caps)
  expect(model.nodes[0]?.steps.map(s => s.tool)).toEqual(['Read', 'Bash'])
})

test('AC-007: limite de 200 passos descarta os mais antigos e conta os descartados', () => {
  let a = mk()
  for (let i = 0; i < MAX_STEPS + 5; i++) a = pushStep(a, toolStep(`t${i}`, 'Read', {}, T0 + i, 1, {}))
  expect(a.steps?.length).toBe(MAX_STEPS)
  expect(a.droppedSteps).toBe(5)
  expect(a.steps?.[0]?.id).toBe('t5')
})

// AC-008 / S-008 / I-008: unknown stays undefined, never zero
test('AC-008: sem fonte de tokens, tokens e custo ficam undefined, nunca zero', () => {
  expect(usageOf({ usage: null })).toBeUndefined()
  expect(usageOf({})).toBeUndefined()
  const a = addUsage(mk(), undefined)
  expect(a.usage).toBeUndefined()
  const model = buildRunModel([mk()], T0 + 1000, caps)
  expect(model.nodes[0]?.usage).toEqual({})
  expect(model.totals.tokens).toBeUndefined()
  expect(model.totals.costUsd).toBeUndefined()
})

test('AC-008: tokens de turn.step somam por agente (entrada + saída + cache)', () => {
  const u1 = usageOf({ usage: { model: 'm', input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 1 } })
  expect(u1).toEqual({ tokens: 18 })
  let a = addUsage(mk(), u1)
  a = addUsage(a, usageOf({ usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }))
  expect(a.usage).toEqual({ tokens: 20 })
  const model = buildRunModel([a], T0 + 1000, caps)
  expect(model.totals.tokens).toBe(20)
  expect(model.nodes[0]?.usage).toEqual({ tokens: 20 })
})

// AC-009 / S-009 / I-009: a capture error returns the agent untouched and writes nothing
test('AC-009: erro na captura devolve o agente inalterado, sem passo', () => {
  const a = mk()
  const out = recordSafely(a, () => { throw new Error('boom') })
  expect(out).toBe(a)
  expect(out.steps).toBeUndefined()
  const ok = recordSafely(a, () => toolStep('tu9', 'Read', { file_path: '/a/b.ts' }, T0, 5, {}))
  expect(ok.steps?.length).toBe(1)
})
