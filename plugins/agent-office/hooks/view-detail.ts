// T-009: detalhe de um agente na ordem do Padrão (spec/05-ui-design.md) e progresso honesto.
// Puro: sem engine, sem disco. Todo texto vindo do agente (nome, ferramenta, worktree, pai, filhos, prompt, erro) passa por
// maskText antes de ser desenhado. `detailView` entrega Lines com os segmentos clicáveis (links, p/n, anexos); `detailScreen`
// entrega só o texto dessas mesmas linhas.
import { buildGraph, durationOf } from './run-model'
import type { Node } from './run-model'
import type { AgentLike } from './office'
import type { Line, Seg } from './monitor'
import { nodeView, stateColor, keyOf } from './vocabulary'
import { maskText } from './mask'
import { chips } from './persona'
import type { State } from './run-model'

const BAR_CELLS = 10
const DIM = '#9ca3af'
const fmt = (ms: number): string => {
  const s = Math.floor(ms / 1000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(Math.floor(s / 60))}:${p(s % 60)}`
}
const dash = (v: string | undefined): string => (v && v.length ? v : '—')

// Progresso só com total conhecido (`3/5 tarefas`). Sem total: só os segmentos feitos, sem %, sem previsão.
export function progressText(done: number, total: number | undefined): string {
  if (total === undefined || total <= 0) {
    return done > 0 ? `${'▰'.repeat(done)} · sem total conhecido` : 'sem total conhecido'
  }
  const filled = Math.min(BAR_CELLS, Math.max(0, Math.round((done / total) * BAR_CELLS)))
  return `${'▰'.repeat(filled)}${'▱'.repeat(BAR_CELLS - filled)} ${done}/${total} tarefas`
}

export type DetailScreen = { lines: string[]; back: boolean; warning?: string }
export type DetailView = { lines: Line[]; back: boolean; warning?: string }
export const GONE = 'O agente saiu da lista; voltando à lista.'
export const IO_OFF = 'Entrada/saída das ferramentas: desligado. Defina OFFICE_CAPTURE_IO=1 para ligar.'

const MUTED = '#A9ADB5' // cor "muted" do desenho: células vazias da mini-barra
const s = (t: string, extra: Partial<Seg> = {}): Seg => ({ t, ...extra })
const sp = (n: number): Seg[] => (n > 0 ? [s(' '.repeat(n))] : [])
const title = (t: string): Line => [s(t, { bold: true })]

/** Mini-barra ▬ de BAR_CELLS células: preenche a proporção feita/total na cor do estado; sem total, tudo vazio (muted). */
export function miniBar(done: number, total: number | undefined, color: string): Line {
  const filled = total && total > 0 ? Math.min(BAR_CELLS, Math.max(0, Math.round((done / total) * BAR_CELLS))) : 0
  return [s('▬'.repeat(filled), { fg: color }), s('▬'.repeat(BAR_CELLS - filled), { fg: MUTED })]
}

// Agente que sumiu da lista (saiu do limite, foi resetado): `back` true, a tela chama quem desenha de volta à lista com aviso.
export function detailView(agents: AgentLike[], id: string, now: number, o: { captureIo?: boolean; ascii?: boolean } = {}): DetailView {
  const a = agents.find(x => x.id === id)
  const g = a ? buildGraph(agents, now) : undefined
  const n = g?.nodes.get(id)
  if (!a || !g || !n) return { lines: [], back: true, warning: GONE }

  const nm = (x: Node): string => maskText(x.name)
  const link = (x: Node): Seg => s(`${nodeView(x.state, { ascii: o.ascii === true, color: true }).glyph} ${nm(x)}`, { fg: stateColor(x.state), node: x.kind === 'agent' ? x.id : undefined })
  const parent = g.nodes.get(n.parentId)
  const parentAgent = parent && parent.kind === 'agent' ? parent : undefined
  const kids = n.children.filter(k => k.kind === 'agent')
  const sibs = (parent?.children ?? []).filter(k => k.kind === 'agent')
  const idx = sibs.findIndex(k => k.id === id)
  const persona = [n.persona, n.model, n.effort].map(v => dash(v ? maskText(v) : undefined))
  const total = a.todos?.length ? a.todos.length : undefined
  const done = a.todos?.length ? a.todos.filter(t => t.status === 'completed').length : kids.filter(k => k.state === 'done').length
  const wt = n.git?.worktree ? maskText(n.git.worktree) : undefined
  const br = n.git?.branch ? maskText(n.git.branch) : undefined
  const blocked = n.children.flatMap(k => k.dependsOn).map(d => g.nodes.get(d)).filter((x): x is Node => !!x && x.state !== 'done')
  const gv = nodeView(n.state, { ascii: o.ascii === true, color: true })
  const tokens = a.usage?.tokens !== undefined ? String(a.usage.tokens) : '—'

  const out: Line[] = [
    // breadcrumb com `b voltar` à direita, sem caixas
    [s(`Office › ${parentAgent ? nm(parentAgent) + ' › ' : ''}${nm(n)}`), s('  b voltar', { fg: DIM })],
    // linha de estado: ✗ Falhou · Persona · Modelo · esforço · ⧉ branch · mm:ss · tokens · ~$
    [s(`${gv.glyph.trim()} ${nodeView(n.state, { ascii: true, color: false }).label}`, { fg: stateColor(n.state) }),
      s(` · ${persona.join(' · ')} · ⧉ ${br ?? wt ?? '—'} · ${fmt(durationOf(n, now))} · ${tokens} · ~$ —`, { fg: DIM })],
    miniBar(done, total, stateColor(n.state)),
    [s(n.error ? maskText(n.error) : '—', { fg: stateColor(n.state) })],
    [],
    title('Linha do tempo'),
  ]
  const steps = a.steps ?? []
  if (steps.length) {
    for (const st of steps) {
      const at = fmt(Math.max(0, st.startedAt - a.startedAt))
      const dur = st.durationMs !== undefined ? `${Math.round(st.durationMs / 1000)}s` : '—'
      out.push([s(`${at}  ${maskText(st.tool)}  ${maskText(st.label)}  ${dur}`)])
      if (o.captureIo && st.io) {
        out.push([s(`    entrada: ${maskText(st.io.input)}`, { fg: DIM })])
        if (st.io.output !== undefined) out.push([s(`    saída: ${maskText(st.io.output)}`, { fg: DIM })])
      }
    }
  } else if (a.recent?.length) for (const r of [...a.recent].reverse()) out.push([s(`—  ${maskText(r)}`)])
  else out.push([s('—')])

  out.push([], title('Prompt · segredos mascarados'), [s(a.prompt ? maskText(a.prompt) : '—')])
  out.push([], title('Dependências'))
  out.push([s('  Pai: ', { fg: DIM }), parentAgent ? link(parentAgent) : s('sessão')])
  out.push([s('  Filhos: ', { fg: DIM }), ...(kids.length ? kids.slice(0, 6).flatMap((k, i) => [...sp(i ? 1 : 0), link(k)]) : [s('—')])])
  out.push([s('  Bloqueado por: ', { fg: DIM }), ...(blocked.length ? blocked.slice(0, 4).flatMap((k, i) => [...sp(i ? 1 : 0), link(k)]) : [s('—')])])
  if (sibs.length > 1) {
    const pk = keyOf('prevSibling'), nk = keyOf('nextSibling')
    out.push([s(`  Irmãos (${idx + 1}/${sibs.length}): `, { fg: DIM }),
      ...(idx > 0 ? [s(`${pk}: anterior `, { node: sibs[idx - 1]!.id, hotkey: pk })] : []),
      ...(idx < sibs.length - 1 ? [s(`${nk}: próximo`, { node: sibs[idx + 1]!.id, hotkey: nk })] : []),
      ...sibs.filter(k => k.id !== id).slice(0, 4).flatMap(k => [...sp(1), link(k)])])
  }
  if (a.todos?.length) {
    out.push([], title('Tarefas'))
    for (const t of a.todos) out.push([s(`  ${t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '●' : '○'} ${maskText(t.content)}`)])
  }
  if (a.files?.length) {
    out.push([], title('Anexos'))
    for (const f of a.files) out.push([s('  ' + maskText(f), { fg: '#60a5fa', attach: f })]) // `attach` keeps the real path for the preview; only the text is masked
  }
  if (!o.captureIo) out.push([], [s(IO_OFF, { fg: DIM })])
  return { lines: out, back: false }
}

const textOf = (l: Line): string => l.map(x => x.t).join('')

export function detailScreen(agents: AgentLike[], id: string, now: number, o: { captureIo?: boolean; ascii?: boolean } = {}): DetailScreen {
  const v = detailView(agents, id, now, o)
  return { lines: v.lines.map(textOf), back: v.back, ...(v.warning ? { warning: v.warning } : {}) }
}

// Structured data for the app pane's side detail (Proto5 aside): same masking and facts as detailView, no text lines.
export type DetailStep = { at: string; tool: string; label: string; dur: string; ok?: boolean; ms?: number }
export type DetailData = {
  crumb: string; name: string; state: State; stateLabel: string; chips: string[]; branch?: string
  done: number; total?: number; time: string; tokens: string; cost: string; error?: string; steps: DetailStep[]; prompt: string
}
export function detailData(agents: AgentLike[], id: string, now: number): DetailData | undefined {
  const a = agents.find(x => x.id === id)
  const g = a ? buildGraph(agents, now) : undefined
  const n = g?.nodes.get(id)
  if (!a || !g || !n) return undefined
  const parent = g.nodes.get(n.parentId)
  const parentAgent = parent && parent.kind === 'agent' ? parent : undefined
  const kids = n.children.filter(k => k.kind === 'agent')
  const ch = chips(n.persona, n.model, n.effort)
  const steps: DetailStep[] = (a.steps ?? []).map(st => ({
    at: fmt(Math.max(0, st.startedAt - a.startedAt)), tool: maskText(st.tool), label: maskText(st.label),
    dur: st.durationMs !== undefined ? `${Math.round(st.durationMs / 1000)}s` : '—', ok: st.ok, ms: st.durationMs,
  }))
  const br = n.git?.branch ? maskText(n.git.branch) : undefined, wt = n.git?.worktree ? maskText(n.git.worktree) : undefined
  return {
    crumb: `Office › ${parentAgent ? maskText(parentAgent.name) + ' › ' : ''}${ch.persona ?? maskText(n.persona || 'Agente')}`,
    name: maskText(n.name), state: n.state, stateLabel: nodeView(n.state, { ascii: true, color: false }).label,
    chips: [ch.persona, ch.model, ch.effort].filter((x): x is string => !!x), branch: br ? `⎇ ${br}` : wt ? `⧉ ${wt}` : undefined,
    done: a.todos?.length ? a.todos.filter(t => t.status === 'completed').length : kids.filter(k => k.state === 'done').length,
    total: a.todos?.length ? a.todos.length : undefined,
    time: fmt(durationOf(n, now)), tokens: a.usage?.tokens !== undefined ? String(a.usage.tokens) : '—',
    cost: a.usage?.costUsd !== undefined ? `$${a.usage.costUsd.toFixed(2)}` : '—',
    error: n.error ? maskText(n.error) : undefined, steps, prompt: a.prompt ? maskText(a.prompt) : '—',
  }
}
