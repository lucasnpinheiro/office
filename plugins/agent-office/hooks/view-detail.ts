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
import { spinnerGlyph } from './motion'
import { strWidth, takeWidth, truncRunes } from './monitor'
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

// Layout 0.28.10 (approved): voltar + breadcrumb, estado, métricas, barra, then SOLICITAÇÃO / ANDAMENTO / CONCLUSÃO / CONTEXTO.
const kTok = (n: number): string => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const money = (v: number): string => `~$${v.toFixed(2).replace('.', ',')}`
const escRe = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Prompt boilerplate that says nothing about the task: output-style lines and bare directory lines.
const BOILER = /^\s*(\[[\w-]+\]\s*)?(respond|responda|answer)\b.*\b(caveman|mode|modo|full|lite|ultra)\b|^\s*(dir|cwd|repo|directory)\s*[:=]/i
export function promptSummary(prompt: string, width: number, maxLines = 3): { lines: string[]; more: number } {
  const words = prompt.split('\n').filter(l => l.trim() && !BOILER.test(l)).join(' ').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = '', used = 0
  for (const w0 of words) {
    const w = strWidth(w0) > width ? takeWidth(w0, width - 1) + '…' : w0 // one word wider than the row is cut, never a row mid-word
    if (cur && strWidth(cur) + 1 + strWidth(w) > width) {
      lines.push(cur); cur = ''
      if (lines.length === maxLines) break
    }
    cur = cur ? `${cur} ${w}` : w; used++
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  const more = Math.max(0, words.length - used)
  if (more && lines.length) lines[lines.length - 1] = truncRunes(lines[lines.length - 1]! + ' …', width)
  return { lines, more }
}
// Path shown relative to the scratchpad/home, with a middle ellipsis when still too long (never wrapped mid-path).
export function shortPath(p: string, width: number): string {
  const r = p.replace(/^.*\/scratchpad\//, '').replace(/^\/(?:Users|home)\/[^/]+\//, '~/')
  if (strWidth(r) <= width) return r
  const keep = Math.max(3, width - 1), head = Math.ceil(keep / 3), tail = keep - head
  const chars = [...r]
  return chars.slice(0, head).join('') + '…' + chars.slice(chars.length - tail).join('')
}
const cut = (l: Line, w: number): Line => {
  const out: Line = []
  let used = 0
  for (const x of l) {
    const room = w - used
    if (room <= 0) break
    const t = strWidth(x.t) <= room ? x.t : truncRunes(x.t, room)
    out.push({ ...x, t }); used += strWidth(t)
  }
  return out
}
const padTo = (l: Line, w: number, right: Line): Line => {
  const used = [...l, ...right].reduce((a, x) => a + strWidth(x.t), 0)
  return [...l, ...sp(Math.max(1, w - used)), ...right]
}

// Agente que sumiu da lista (saiu do limite, foi resetado): `back` true, a tela chama quem desenha de volta à lista com aviso.
export function detailView(agents: AgentLike[], id: string, now: number, o: { captureIo?: boolean; ascii?: boolean; width?: number; frame?: number } = {}): DetailView {
  const a = agents.find(x => x.id === id)
  const g = a ? buildGraph(agents, now) : undefined
  const n = g?.nodes.get(id)
  if (!a || !g || !n) return { lines: [], back: true, warning: GONE }
  const W = Math.max(30, o.width ?? 100)

  const nm = (x: Node): string => maskText(x.name)
  const link = (x: Node): Seg => s(`${nodeView(x.state, { ascii: o.ascii === true, color: true }).glyph} ${nm(x)}`, { fg: stateColor(x.state), node: x.kind === 'agent' ? x.id : undefined })
  const chipsOf = (xs: Node[]): Seg[] => xs.flatMap((k, i) => [...sp(i ? 2 : 0), link(k)])
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
  const col = stateColor(n.state)
  const head = (t: string, right = ''): Line => [s('▌ ', { fg: col }), s(t, { bold: true }), ...(right ? padTo([], W - strWidth(t) - 2, [s(right, { fg: DIM })]) : [])]

  const metrics = [`⧉ ${shortPath(br ?? wt ?? '—', Math.max(12, Math.floor(W / 2)))}`, `⏱ ${fmt(durationOf(n, now))}`,
    ...(a.usage?.tokens !== undefined ? [`${kTok(a.usage.tokens)} tok`] : []), ...(a.usage?.costUsd !== undefined ? [money(a.usage.costUsd)] : [])]
  const pct = n.state === 'done' ? 1 : total ? done / total : undefined
  const cells = Math.min(20, Math.max(8, W - 12)), fill = Math.round((pct ?? 0) * cells)
  const out: Line[] = [
    padTo([s('[← voltar]', { fg: DIM, act: 'back' })], W, [s(`Office › ${parentAgent ? nm(parentAgent) + ' › ' : ''}${nm(n)}`)]),
    [s(`${gv.glyph.trim()} ${nodeView(n.state, { ascii: true, color: false }).label}`, { fg: col, bold: true }), s(`   ${persona.join(' · ')}`, { fg: DIM })],
    [s(metrics.join('  '), { fg: DIM })],
    [s('█'.repeat(fill), { fg: col }), s('░'.repeat(cells - fill), { fg: MUTED }), s(pct === undefined ? '  sem total conhecido' : `  ${Math.round(pct * 100)}%`, { fg: DIM })],
    [],
  ]
  // SOLICITAÇÃO
  const ps = promptSummary(a.prompt ? maskText(a.prompt) : '', W - 2)
  out.push(head('SOLICITAÇÃO'), ...(ps.lines.length ? ps.lines.map(t => [s(`  ${t}`)]) : [[s('  —')]]), [])
  // ANDAMENTO
  const steps = a.steps ?? []
  const span = steps.length ? Math.round((Math.max(...steps.map(x => x.startedAt + (x.durationMs ?? 0))) - a.startedAt) / 1000) : 0
  out.push(head('ANDAMENTO', steps.length ? `${steps.length} passo${steps.length > 1 ? 's' : ''} · ${span}s` : ''))
  for (const st of steps) {
    const tool = maskText(st.tool), label = maskText(st.label).replace(new RegExp(`^${escRe(tool)}\\s+`), '')
    const dur = st.durationMs !== undefined ? `${Math.round(st.durationMs / 1000)}s` : ''
    const left = [s(`  ${fmt(Math.max(0, st.startedAt - a.startedAt))} `, { fg: DIM }), s(st.ok === false ? '✗' : '✓', { fg: st.ok === false ? stateColor('failed') : stateColor('done') }), s(` ${tool.padEnd(5)} ${label}`)]
    out.push(padTo(left, W, [s(dur, { fg: DIM })]))
    if (o.captureIo && st.io) {
      out.push([s(`    entrada: ${maskText(st.io.input)}`, { fg: DIM })])
      if (st.io.output !== undefined) out.push([s(`    saída: ${maskText(st.io.output)}`, { fg: DIM })])
    }
  }
  if (n.state === 'running' && n.tool) out.push([s(`  ${spinnerGlyph(o.frame ?? 0, o.ascii === true)} ${maskText(n.tool)}`, { fg: col })])
  else if (!steps.length && a.recent?.length) for (const r of [...a.recent].reverse()) out.push([s(`  —  ${maskText(r)}`)])
  else if (!steps.length) out.push([s('  —')])
  if (!o.captureIo) out.push([s(`  ${IO_OFF}`, { fg: DIM })])
  out.push([])
  // CONCLUSÃO
  out.push(head('CONCLUSÃO'))
  const report = (a as { report?: string }).report
  const concl = n.error ? maskText(n.error) : report ? maskText(report) : n.state === 'done' ? 'concluído' : 'em andamento…'
  for (const t of promptSummary(concl, W - 2).lines) out.push([s(`  ${t}`, { fg: n.error ? col : undefined })])
  for (const f of a.files ?? []) out.push([s('  📎 ', { fg: DIM }), s(shortPath(maskText(f), W - 6), { fg: '#60a5fa', attach: f })]) // `attach` keeps the real path for the preview; only the text is masked
  out.push([])
  // CONTEXTO
  out.push(head('CONTEXTO'))
  out.push([s('  Pai: ', { fg: DIM }), parentAgent ? link(parentAgent) : s('sessão'), s('  ·  Filhos: ', { fg: DIM }), ...(kids.length ? chipsOf(kids.slice(0, 4)) : [s('—')]),
    s('  ·  Bloqueio: ', { fg: DIM }), ...(blocked.length ? chipsOf(blocked.slice(0, 3)) : [s('—')])])
  if (sibs.length > 1) {
    const pk = keyOf('prevSibling'), nk = keyOf('nextSibling')
    out.push([s(`  Irmãos ${idx + 1}/${sibs.length}: `, { fg: DIM }),
      ...(idx > 0 ? [s(`${pk}: ‹ `, { node: sibs[idx - 1]!.id, hotkey: pk })] : []),
      ...chipsOf(sibs.filter(k => k.id !== id).slice(0, 4)),
      ...(idx < sibs.length - 1 ? [s(` ${nk}: ›`, { node: sibs[idx + 1]!.id, hotkey: nk })] : [])])
  }
  if (a.todos?.length) {
    out.push([], head('TAREFAS'))
    for (const t of a.todos) out.push([s(`  ${t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '●' : '○'} ${maskText(t.content)}`)])
  }
  return { lines: out.map(l => cut(l, W)), back: false }
}

// j/k in a detail: the body moves 3 lines per press, clamped to the first and the last line.
export const detailScrollStep = (cur: number, dir: 'scrollDown' | 'scrollUp', total: number): number =>
  Math.max(0, Math.min(Math.max(0, total - 1), cur + (dir === 'scrollDown' ? 3 : -3)))

const textOf = (l: Line): string => l.map(x => x.t).join('')

export function detailScreen(agents: AgentLike[], id: string, now: number, o: { captureIo?: boolean; ascii?: boolean; width?: number } = {}): DetailScreen {
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
