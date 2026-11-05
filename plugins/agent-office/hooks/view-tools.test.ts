import { test, expect } from 'claude-code/testing'
import { toolLines } from './view-tools'
import { buildRunModel } from './run-model'
import type { ToolStep } from './run-model'
import { detectCaps } from './compact'
import { CAPABILITIES } from './capabilities'
import type { AgentLike } from './office'

// T-010 (Visão Ferramentas). Rendered output is tested as text. Counts and last duration; I/O only with captureIo.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const caps = detectCaps({ LANG: 'pt_BR.UTF-8' })
const step = (id: string, tool: string, durationMs: number, io?: ToolStep['io']): ToolStep => ({ id, tool, label: tool, startedAt: T, durationMs, ok: true, io })
const model = (agents: AgentLike[]) => buildRunModel(agents, T + 5000, CAPABILITIES)
const view = () => ({ width: 100, caps })

const withSteps = [
  mk('a', { steps: [step('1', 'Read', 800), step('2', 'Read', 1200), step('3', 'Bash', 4500)] }),
  mk('b', { status: 'error', error: 'boom', steps: [step('4', 'Edit', 300)] }),
]

// AC-033 (tools side): with no cost data the tools view still lists counts and durations
test('AC-033 ferramentas: lista contagem e última duração por ferramenta', () => {
  const out = txt(toolLines(model(withSteps), T + 5000, view(), false))
  expect(out).toMatch(/Read ×2.*1,2 s/) // última duração de Read: 1200 ms
  expect(out).toMatch(/Bash ×1.*4,5 s/)
  expect(out).toMatch(/Edit ×1.*0,3 s/)
})

test('ferramentas: sem captureIo não mostra entrada nem saída', () => {
  const io = { input: 'ls /secret', output: 'resultado' }
  const out = txt(toolLines(model([mk('a', { steps: [step('1', 'Bash', 100, io)] })]), T + 5000, view(), false))
  expect(out).not.toContain('ls /secret')
  expect(out).not.toContain('resultado')
})

test('ferramentas: com captureIo mostra entrada e saída já mascaradas', () => {
  const io = { input: 'curl ••••••••', output: 'ok' }
  const out = txt(toolLines(model([mk('a', { steps: [step('1', 'Bash', 100, io)] })]), T + 5000, view(), true))
  expect(out).toContain('curl ••••••••')
  expect(out).toContain('ok')
})

test('ferramentas: sem nenhum passo mostra vazio, sem invenção', () => {
  const out = txt(toolLines(model([mk('x')]), T + 5000, view(), false))
  expect(out).toContain('Sem ferramentas')
  expect(out).not.toMatch(/×\d/)
})
