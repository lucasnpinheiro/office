import { test, expect } from 'claude-code/testing'
import { detailScreen, detailView, progressText } from './view-detail'
import { buildGraph, etaOf } from './run-model'
import { CAPABILITIES, canUse } from './capabilities'
import { MASK } from './mask'
import type { AgentLike } from './office'

// T-009 (Detalhe e progresso honesto). Rendered output is tested as text; ACs from tasks/T-009-detail-progress.md.
const T0 = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T0, seenAt: T0, ...o })
const text = (ls: string[]) => ls.join('\n')

// AC-027: order of the Padrão: trilha, estado, persona e modelo, worktree, tempo, tokens, custo, erro, linha do tempo, dependências, prompt
test('AC-027 detalhe: ordem do Padrão, b voltar, sem controles sem capacidade', () => {
  const a = mk('a1', {
    description: 'Tester',
    status: 'error', endedAt: T0 + 7000, error: '2 de 14 testes falham: cupom não aplicado',
    model: 'haiku', effort: 'low', git: { worktree: 'spec/checkout-api', branch: 'spec/checkout-api' },
    recent: ['Read tests/checkout', 'Bash npm test'], prompt: 'Rodar os testes de checkout.',
  })
  const r = detailScreen([a], 'a1', T0 + 8000)
  const out = text(r.lines)
  const order = ['Estado', 'Haiku', 'spec/checkout-api', 'Tempo', 'Tokens', 'Custo', 'Erro', 'Linha do tempo', 'Dependências', 'Prompt']
  const pos = order.map(k => out.indexOf(k))
  expect(pos.every(p => p >= 0)).toBe(true)
  expect([...pos].sort((x, y) => x - y)).toEqual(pos)
  expect(out).toContain('Tokens: —') // no usage data: dash, never zero
  expect(out).toContain('Custo: —')
  expect(out).toContain('b voltar')
  expect(out).not.toContain('Esc')
  // no action capability is yes today: no control shown
  expect(canUse(CAPABILITIES, 'stop', 'terminal')).toBe(false)
  expect(out).not.toMatch(/x parar|r repetir|a abrir no chat|y copiar/)
})

// AC-027: prompt is masked before it is shown
test('AC-027 prompt mascarado: segredo nunca aparece', () => {
  const a = mk('a2', { prompt: 'use token: abc123secretvalue para o deploy' })
  const out = text(detailScreen([a], 'a2', T0 + 1).lines)
  expect(out).not.toContain('abc123secretvalue')
  expect(out).toContain(MASK)
})

// AC-028: no known total -> only done segments, no percentage, no promise
test('AC-028 progresso sem total conhecido: só segmentos, sem %', () => {
  const s = progressText(2, undefined)
  expect(s).toContain('▰▰')
  expect(s).not.toContain('%')
  expect(s).not.toMatch(/\//)
})

test('AC-028 progresso com total conhecido: contagem real, sem %', () => {
  const s = progressText(3, 5)
  expect(s).toContain('3/5')
  expect(s).not.toContain('%')
})

// AC-029: agent leaves the list while open -> back to the list with a warning, no throw
test('AC-029 agente some da lista: volta com aviso', () => {
  const r = detailScreen([mk('x')], 'gone', T0 + 1)
  expect(r.back).toBe(true)
  expect(r.warning).toContain('saiu da lista')
  expect(r.lines).toEqual([])
})

// AC-030: ETA needs at least 3 finished agents of the same model
test('AC-030 ETA: 2 concluídos do mesmo modelo não mostram estimativa', () => {
  const two = [mk('a', { status: 'done', endedAt: T0 + 60_000, model: 'sonnet' }), mk('b', { status: 'done', endedAt: T0 + 120_000, model: 'sonnet' }), mk('c', { model: 'sonnet' })]
  expect(etaOf(buildGraph(two, T0 + 1))).toBeUndefined()
})

test('AC-030 ETA: 3 concluídos do mesmo modelo mostram estimativa', () => {
  const three = [
    mk('a', { status: 'done', endedAt: T0 + 60_000, model: 'sonnet' }),
    mk('b', { status: 'done', endedAt: T0 + 120_000, model: 'sonnet' }),
    mk('c', { status: 'done', endedAt: T0 + 90_000, model: 'sonnet' }),
    mk('d', { model: 'sonnet' }),
  ]
  expect(etaOf(buildGraph(three, T0 + 130_000))).toBeDefined()
})

test('AC-030 ETA: 3 concluídos de modelos diferentes não mostram estimativa', () => {
  const mixed = [
    mk('a', { status: 'done', endedAt: T0 + 60_000, model: 'sonnet' }),
    mk('b', { status: 'done', endedAt: T0 + 120_000, model: 'haiku' }),
    mk('c', { status: 'done', endedAt: T0 + 90_000, model: 'opus' }),
    mk('d', { model: 'sonnet' }),
  ]
  expect(etaOf(buildGraph(mixed, T0 + 130_000))).toBeUndefined()
})

// T-009 (revisão): todo texto do agente passa por maskText ao desenhar, mesmo dado antigo ainda sem máscara
test('AC-027 máscara no detalhe: nome, ferramenta, worktree, pai, filhos, descrição, erro, linha do tempo e arquivos', () => {
  const SECRET = 'xyz999secretvalue'
  const parent = mk('p1', { agentId: 'P', description: `Dev: pai token=${SECRET}` })
  const a = mk('a1', {
    agentId: 'A', parentAgentId: 'P', description: `Dev: nome token=${SECRET}`, tool: `Bash token=${SECRET}`,
    git: { worktree: `wt token=${SECRET}`, branch: `br token=${SECRET}` }, status: 'error', error: `falhou token=${SECRET}`,
    steps: [{ id: 's1', tool: `Tool token=${SECRET}`, label: `rodou token=${SECRET}`, startedAt: T0, durationMs: 1000, io: { input: `in token=${SECRET}`, output: `out token=${SECRET}` } }],
    files: [`/x/token=${SECRET}.ts`], todos: [{ content: `fazer token=${SECRET}`, status: 'pending' }],
  })
  const kid = mk('k1', { agentId: 'K', parentAgentId: 'A', description: `Dev: filho token=${SECRET}` })
  const v = detailView([parent, a, kid], 'a1', T0 + 5000, { captureIo: true })
  const out = v.lines.map(l => l.map(s => s.t).join('')).join('\n')
  expect(out).not.toContain(SECRET)
  expect(out).toContain(MASK)
  // o caminho real do anexo continua no segmento clicável (só o texto exibido é mascarado)
  expect(v.lines.flat().some(s => s.attach === `/x/token=${SECRET}.ts`)).toBe(true)
})

test('AC-027 detalhe: links de pai e filhos, anexos e tarefas do detalhe anterior continuam', () => {
  const a = mk('a1', { agentId: 'A', todos: [{ content: 'passo', status: 'in_progress' }], files: ['/x/a.diff'], parentAgentId: 'P' })
  const v = detailView([mk('p1', { agentId: 'P' }), a, mk('k1', { agentId: 'K', parentAgentId: 'A' }), mk('a2', { agentId: 'B', parentAgentId: 'P' })], 'a1', T0 + 1)
  const segs = v.lines.flat()
  expect(segs.filter(s => s.node).map(s => s.node)).toEqual(expect.arrayContaining(['p1', 'k1', 'a2']))
  expect(segs.some(s => s.hotkey === 'n')).toBe(true)
  expect(segs.some(s => s.attach === '/x/a.diff')).toBe(true)
  expect(v.lines.map(l => l.map(s => s.t).join('')).join('\n')).toContain('● passo')
})

test('AC-027 detalhe com captura ligada mostra entrada/saída mascaradas na linha do tempo', () => {
  const a = mk('a1', { steps: [{ id: 's1', tool: 'Bash', label: 'ls', startedAt: T0, io: { input: 'ls -la', output: 'total 0' } }] })
  const on = detailScreen([a], 'a1', T0 + 1, { captureIo: true }).lines.join('\n')
  expect(on).toContain('entrada: ls -la')
  expect(on).toContain('saída: total 0')
  expect(detailScreen([a], 'a1', T0 + 1).lines.join('\n')).not.toContain('entrada:')
})

// Achado PR 19: os links (pai, filhos, bloqueios, irmãos) usam o glifo do vocabulário, ASCII quando pedido.
test('detalhe: links de pai e filhos honram o vocabulário ASCII', () => {
  const ag = [mk('p1', { agentId: 'P' }), mk('a1', { agentId: 'A', parentAgentId: 'P' }), mk('k1', { agentId: 'K', parentAgentId: 'A' })]
  const links = (o: { ascii?: boolean }) => detailView(ag, 'a1', T0 + 1, o).lines.flat().filter(x => x.node).map(x => x.t)
  expect(links({}).every(t => /^\S+ /.test(t))).toBe(true)
  const asc = links({ ascii: true })
  expect(asc.length).toBeGreaterThan(0)
  for (const t of asc) expect(t).toMatch(/^(\.\.|\[\S+\]|\|\|) /)
  expect(asc.join('')).not.toMatch(/[⠹○✓✗▲■]/u)
})
