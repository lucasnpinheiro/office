import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import type { CView } from './compact'
import type { AgentLike } from './office'

// T-007 (Visão Worktrees). Rendered output is tested as text; ACs from tasks/T-007-worktree-view.md.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const view = (over: Partial<CView> = {}): CView => ({ width: 120, caps: detectCaps({ LANG: 'pt_BR.UTF-8' }), mode: 'grouped', query: '', expanded: new Set<string>(), maxCardRows: 4, ...over })
const R = '/repo/.claude/worktrees'

// two worktrees and the main branch: feat-a has 2 agents (1 failed, 2 files), feat-b has 1 done
const wtAgents: AgentLike[] = [
  mk('a1', { cwd: `${R}/feat-a`, git: { branch: 'feat-a', worktree: 'feat-a' }, files: [`${R}/feat-a/x.ts`] }),
  mk('a2', { cwd: `${R}/feat-a`, git: { branch: 'feat-a', worktree: 'feat-a' }, status: 'error', error: 'boom', files: [`${R}/feat-a/x.ts`, `${R}/feat-a/y.ts`] }),
  mk('b1', { cwd: `${R}/feat-b`, git: { branch: 'feat-b', worktree: 'feat-b' }, status: 'done', endedAt: T + 1000 }),
  mk('m1', { cwd: '/repo', git: { branch: 'main' } }),
]

// AC-021: agentes por branch sob divisor, com quantidade, falhas, arquivos e base +N commits
test('AC-021 worktrees: divisor de cada branch com quantidade e falhas', () => {
  const out = txt(renderCompact(wtAgents, T + 5000, view({ ahead: { 'feat-a': 3 } })))
  const div = out.split('\n').find(l => l.includes('feat-a') && l.includes('━'))
  expect(div).toBeDefined()
  expect(div!).toContain('2 agentes')
  expect(div!).toContain('1 falha')
  expect(div!).toContain('2 arquivos')
  expect(out).toContain('feat-b')
  expect(out).toContain('main')
})

test('AC-021 worktrees: base real +N commits quando a contagem existe (chave = raiz do worktree)', () => {
  const ahead = { [`${R}/feat-a`]: { base: 'origin/main', ahead: 3 } }
  const out = txt(renderCompact(wtAgents, T + 5000, view({ ahead })))
  expect(out).toContain('base origin/main +3 commits')
  expect(out).not.toContain('base feat-a') // a base nunca é o nome da própria branch
  expect(out.match(/commits/g)).toHaveLength(1) // só o grupo com contagem
})

test('AC-021 worktrees: cada agente aparece uma só vez, aninhado sob o divisor do seu worktree', () => {
  const lines = txt(renderCompact(wtAgents, T + 5000, view())).split('\n')
  const at = (re: RegExp) => lines.findIndex(l => re.test(l))
  for (const n of ['Dev: a1', 'Dev: a2', 'Dev: b1', 'Dev: m1']) expect([n, lines.filter(l => l.includes(n) && /[├└]─/.test(l)).length]).toEqual([n, 1])
  const dA = at(/━.*feat-a.*━/), dB = at(/━.*feat-b.*━/), dM = at(/━.*main.*━/)
  expect(at(/─.*Dev: a1/)).toBeGreaterThan(dA); expect(at(/─.*Dev: a2/)).toBeGreaterThan(dA)
  expect(at(/─.*Dev: a1/)).toBeLessThan(dB)
  expect(at(/─.*Dev: b1/)).toBeGreaterThan(dB); expect(at(/─.*Dev: b1/)).toBeLessThan(dM)
  expect(at(/─.*Dev: m1/)).toBeGreaterThan(dM)
})

test('AC-021 worktrees: agente sem worktree conhecido continua visível, sob o aviso próprio', () => {
  const out = txt(renderCompact([...wtAgents, mk('x1', { cwd: '/nao/existe' })], T + 5000, view()))
  expect(out).toContain('sem worktree conhecido')
  expect(out.match(/Dev: x1/g)).toHaveLength(1)
})

// AC-022: agente sem isolation na chamada, reconhecido pelo primeiro arquivo dentro de .claude/worktrees
test('AC-022 worktrees: agente com isolamento da definição entra no grupo pelo caminho do arquivo', () => {
  const def = mk('d1', { isolated: true, files: [`${R}/feat-b/src/z.ts`] })
  const out = txt(renderCompact([...wtAgents, def], T + 5000, view()))
  const div = out.split('\n').find(l => l.includes('feat-b') && l.includes('━'))
  expect(div).toBeDefined()
  expect(div!).toContain('2 agentes')
})

// AC-023: sem contagem (git falhou, timeout ou $.process ausente) o +N commits some, nunca mostra zero
test('AC-023 worktrees: sem contagem de commits a linha base não aparece', () => {
  const out = txt(renderCompact(wtAgents, T + 5000, view()))
  expect(out).not.toContain('commits')
  expect(out).not.toContain('+0')
  expect(out).toContain('feat-a')
})

// Achado PR 19: branch e caminho vêm do agente/disco e podem carregar segredo; o divisor mascara os dois.
test('divisor mascara segredo na branch e no nome do worktree vindo do caminho', () => {
  const secret = 'sk-abcdefghijklmnopqrstuvwx1234'
  const byBranch = [mk('s1', { cwd: `${R}/wt`, git: { branch: `fix/token=${secret}`, worktree: 'wt' } })]
  const byPath = [mk('s2', { cwd: `${R}/token=${secret}` })]
  for (const ag of [byBranch, byPath]) {
    const out = txt(renderCompact(ag, T + 5000, view()))
    expect(out).not.toContain(secret)
  }
  expect(txt(renderCompact(byBranch, T + 5000, view()))).toContain('⧉')
})
