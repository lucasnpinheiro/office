import { atom, read, update } from 'claude-code'
import { isAppSurface, appCards, appMap } from './app-cards'
import type { AppCard, AppMapNode } from './app-cards'
import { spinnerGlyph } from './motion'
import { detailData } from './view-detail'
import type { Register, EngineInterface } from 'claude-code'
import type { OfficeAgent, Status } from '../types'
import { frameFor, nextDelay, parseSub, paneWidth, drawSig, ticker } from './office'
import { renderMonitor, inlineSize, WORKTREE_COLOR, buildGraph, elapsedOf, fmtMMSS } from './monitor'
import { TONE as TONE_OF } from './app-cards'
import { scrollInfo, renderCompact, treeHasCollapsed, previewLines, detectCaps, statusText, asciiLine, DEFAULT_MODE, MODES } from './compact'
import type { CView } from './compact'
import { buildRunModel } from './run-model'
import { CAPABILITIES, canUse } from './capabilities'
import { sideDetail } from './layout'
import { detailView } from './view-detail'
import { hasWorkflow } from './view-workflow'
import { worktreeOfAgent } from './view-worktrees'
import { applyAction, FOOTER_SEP, footerTail, hotkeysFor, startUi } from './actions'
import type { Ui } from './actions'
import type { Mode, Caps } from './compact'
import type { Thumb } from './monitor'
import { applyTool, noteTool, shotFrom, pruneShots, endedAtFrom, firstLine, isLaunchAck, launchedAgentId, worktreeOf, isolatedCall } from './stats'
import { addSessionTokens, addUsage, recordSafely, toolStep, usageOf, errorText, toolArgs } from './capture'
import { captureIoOn, maskText } from './mask'
import { resolveGit, aheadOf, cachedAhead } from './git'
import { toggleAction } from './status'
import { statusLines } from './status'
import type { GitInfo, AheadInfo, AheadCache, ProcessRun } from './git'

const PANE = 'agent-office'
const office = atom({ plugin: 'agent-office', key: 'agents' } as const, [])
const isOpen = atom({ plugin: 'agent-office', key: 'open' } as const, false)
const sessionTokensAt = atom({ plugin: 'agent-office', key: 'sessionTokens' } as const, null as number | null) // main-session tokens, null = unknown
const sessionUsdAt = atom({ plugin: 'agent-office', key: 'sessionUsd' } as const, null as number | null) // `$.session.usage().cost.usd` (CLI), null = unknown
const sessionToolAt = atom({ plugin: 'agent-office', key: 'sessionTool' } as const, {})
const collapsedAt = atom({ plugin: 'agent-office', key: 'collapsed' } as const, [])
const selectedAt = atom({ plugin: 'agent-office', key: 'selected' } as const, '')
const viewAt = atom({ plugin: 'agent-office', key: 'view' } as const, 'map')
// true from session.start until the first render: the surface picks the opening view (terminal: cards of TELA 8; app: map)
const autoViewAt = atom({ plugin: 'agent-office', key: 'autoView' } as const, false)
let seenSurface: string | undefined // surface of the last render (module memory, not state)
// the view in effect: until the user picks one, the surface decides (terminal: cards; app surfaces: map)
const onTerminal = () => seenSurface !== undefined && !isAppSurface(seenSurface)
const curView = async ($: EngineInterface): Promise<string> => {
  const stored: string = await read($, viewAt)
  if (seenSurface === undefined) return stored
  if (onTerminal()) return 'compact' // one view in the terminal: the map is an app view
  return (await read($, autoViewAt)) ? 'map' : stored
}
const scrollAt = atom({ plugin: 'agent-office', key: 'scroll' } as const, 0) // first tree line shown by the cards view
const modeAt = atom({ plugin: 'agent-office', key: 'mode' } as const, DEFAULT_MODE as string)
const filterAt = atom({ plugin: 'agent-office', key: 'filter' } as const, 'all')
const sortAt = atom({ plugin: 'agent-office', key: 'sort' } as const, 'time')
const colsAt = atom({ plugin: 'agent-office', key: 'cols' } as const, 0)
const sidAt = atom({ plugin: 'agent-office', key: 'sid' } as const, '')
const searchingAt = atom({ plugin: 'agent-office', key: 'searching' } as const, false)
const queryAt = atom({ plugin: 'agent-office', key: 'query' } as const, '')
const modeChosenAt = atom({ plugin: 'agent-office', key: 'modeChosen' } as const, false)
const expandedAt = atom({ plugin: 'agent-office', key: 'expanded' } as const, [])
const attachAt = atom({ plugin: 'agent-office', key: 'attach' } as const, '')

// OFFICE_CAPTURE_IO=1 (exactly) turns on masked tool input/output capture; read fresh, any failure means off.
const captureIoOf = async ($: EngineInterface): Promise<boolean> => captureIoOn(await Promise.resolve($.env.get('OFFICE_CAPTURE_IO')).catch(() => undefined))

// Terminal capabilities from the environment (ASCII, color depth, reduced motion). Cached for the session.
let capsCache: Caps | undefined
async function capsOf($: EngineInterface): Promise<Caps> {
  if (capsCache) return capsCache
  const g = (v: Promise<string | undefined>) => v.catch(() => undefined)
  const env: Record<string, string | undefined> = {
    TERM: await g($.env.get('TERM')),
    LANG: await g($.env.get('LANG')),
    LC_ALL: await g($.env.get('LC_ALL')),
    LC_CTYPE: await g($.env.get('LC_CTYPE')),
    COLORTERM: await g($.env.get('COLORTERM')),
    NO_COLOR: await g($.env.get('NO_COLOR')),
    OFFICE_ASCII: await g($.env.get('OFFICE_ASCII')),
    OFFICE_REDUCED_MOTION: await g($.env.get('OFFICE_REDUCED_MOTION')),
    CI: await g($.env.get('CI')),
    OS: await g($.env.get('OS')),
    WT_SESSION: await g($.env.get('WT_SESSION')),
    TERM_PROGRAM: await g($.env.get('TERM_PROGRAM')),
  }
  capsCache = detectCaps(env, { isTTY: true }) // the engine draws the pane; there is no raw stdout to probe
  return capsCache
}

const HELP =
  'Uso: /office start | stop | (alterna). /office view [map|compact] (sem valor alterna); /office mode tree|grouped|cards|waterfall|cost|tools|workflow (tree = árvore com conectores; cost = custo e tokens; tools = ferramentas; workflow só mostra algo com execução de workflow; ou g); /office search <texto> (vazio limpa); /office sort time|state|name; /office filter failed|all; /office width <colunas>; /office open <id> (detalhe). Teclas (com o painel focado: ctrl+x tab ou clique): v cicla mapa > árvore > cards (um modo escolhido com g é mantido ao sair do mapa), g modo (cicla árvore, agrupado, cards, linha do tempo, custo, ferramentas e, só com workflow em curso, workflow; na árvore, g abre os grupos recolhidos antes de passar ao modo seguinte), o ordenar, f só falhas, s buscar, Enter detalhe, b voltar, p/n irmaos no detalhe, q fechar. /office collapse | expand recolhe/expande todos os ramos (ou use os botoes). /office status mostra o resumo; /office reset limpa o estado (monitor fechado). Alias: star.'

// Fire-and-forget engine calls (status line, redraw timer, resize, focus) never surface as unhandled rejections.
const bg = (p: unknown): void => { void Promise.resolve(p).catch(() => undefined) }
// Observer hooks: a failure inside one must not change what the rest of the chain sees. In a `.catch` handler `next`
// is replay-safe (Caught): when the hook had called it, `next(e)` returns what that call settled to and nothing
// beneath runs again; when it had not, the chain runs once. Spelled out so a reader need not look it up.
const passOn = (_$: unknown, e: any, next: ((e: any) => any) & { called?: boolean }) => (next.called ? next(e) : next(e))

async function toggleBranch($: EngineInterface, id: string) {
  await update($, collapsedAt, list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
}

// Opt-in browser thumbnails (AGENT_OFFICE_THUMBS=1|on|true|force|warp). Off = nothing below runs.
// Picture bytes (base64 PNG, may show PII) live ONLY in this map: never in an atom, $.store or a file;
// dropped as soon as the agent is not working (pruneShots) and when the monitor closes.
const shots = new Map<string, string>()
async function thumbsOn($: EngineInterface): Promise<boolean> {
  const v = ((await $.env.get('AGENT_OFFICE_THUMBS').catch(() => undefined)) ?? '').trim().toLowerCase()
  return ['1', 'on', 'true', 'yes', 'force', 'warp'].includes(v)
}

// branch/worktree per cwd, read from .git files and cached a few seconds (a checkout changes HEAD in place)
const GIT_TTL_MS = 5000
const gitCache = new Map<string, { at: number; info?: GitInfo }>()

async function refreshGit($: EngineInterface, cwds: (string | undefined)[]) {
  const fs = { read: async (p: string) => String(await $.fs.read(p)), exists: (p: string) => $.fs.exists(p) }
  const now = Date.now()
  for (const c of new Set(cwds.filter((x): x is string => !!x))) {
    const hit = gitCache.get(c)
    if (hit && now - hit.at < GIT_TTL_MS) continue
    gitCache.set(c, { at: now, info: await resolveGit(fs, c).catch(() => undefined) })
  }
}

// agents with their git info from the cache; an isolated agent whose worktree is not known yet shows none
const withGit = (list: OfficeAgent[], sessionCwd: string): OfficeAgent[] =>
  list.map(a => {
    const c = a.cwd || (a.isolated ? '' : sessionCwd)
    const info = c ? gitCache.get(c)?.info : undefined
    return info ? { ...a, git: info } : a
  })

const errText = errorText // masked, then cut to 200 (capture.ts)
// Agent calls with isolation: "worktree", by tool_use_id, from tool.call until the call answers
const isolatedCalls = new Set<string>()
let timer: { cancel: () => void } | undefined
let lastSig = ''
const tick = ticker()

// cancels the armed timer and retires every schedule() still awaiting; returns the new generation
function stopTicking(): number {
  if (timer) timer.cancel()
  timer = undefined
  return tick.next()
}

// one redraw timer at most; self-rescheduling so the rate follows activity
async function schedule($: EngineInterface) {
  const gen = stopTicking()
  if (!(await read($, isOpen))) return
  const list: OfficeAgent[] = await read($, office)
  bg(resizeIfNeeded($))
  const caps = await capsOf($)
  const delay = nextDelay(list, Date.now(), { reducedMotion: caps.reducedMotion, compact: (await curView($)) === 'compact' })
  if (!tick.current(gen)) return // a newer schedule() or a close took over while this one awaited
  bg($.ui.status(statusText(list, Date.now(), caps.ascii)))
  if (delay === undefined) return // nothing running: no animation, no timer
  const t = $.clock.after(delay, () => {
    if (timer === t) timer = undefined
    if (!tick.current(gen)) return
    bg((async () => {
      const latest = await read($, office)
      if (!tick.current(gen)) return // a newer schedule() or a close happened while reading
      const sig = drawSig(latest, Date.now())
      if (sig !== lastSig) { lastSig = sig; $.ui.invalidate('ui.render') } // same frame + data: nothing to redraw
      await schedule($)
    })())
  })
  timer = t
}

// Commits ahead of the real base per worktree (T-007, AC-023): only through `$.process` (CLI; probe 2026-11-05, ADR 0002),
// started in the background (never awaited by a render), 2 s limit, 30 s cache per worktree, failures cached too.
const aheadCache: AheadCache = new Map()
// SubagentStop ids seen before their agent got its agentId (spawn still resolving)
const earlyStops = new Set<string>()
const aheadNow = (): Record<string, AheadInfo> => {
  const out: Record<string, AheadInfo> = {}
  for (const [k, v] of aheadCache) if (v.info) out[k] = v.info
  return out
}
function refreshAhead($: EngineInterface, list: OfficeAgent[], repos: readonly string[]) {
  // no $.process (app) or any failure inside it: the lookup rejects, cachedAhead caches "unknown", and the count is omitted (never zero)
  const run: ProcessRun = async (argv, init) => $.process.run(argv, init)
  for (const key of new Set(list.map(a => worktreeOfAgent(a)).filter((x): x is string => !!x))) {
    const before = aheadCache.get(key)?.info
    bg(cachedAhead(aheadCache, key, Date.now(), () => aheadOf(run, key, repos, undefined, ms => $.clock.sleep(ms))).then(info => {
      if (info?.base !== before?.base || info?.ahead !== before?.ahead) $.ui.invalidate('ui.render')
    }))
  }
}

// RunModel for the compact views: per-agent tokens plus the main session's own turn.step tokens (partial when unknown)
async function runModelOf($: EngineInterface, list: OfficeAgent[], now: number) {
  const tokens: number | null = await read($, sessionTokensAt)
  return buildRunModel(list, now, CAPABILITIES, tokens ?? undefined)
}

// session USD from the engine (CLI: `$.session.usage().cost.usd`, probe 2026-11-05); unknown stays unknown, never zero
let usdBusy = false
async function refreshUsd($: EngineInterface) {
  if (usdBusy) return
  usdBusy = true
  try {
    const u = await $.session.usage()
    const usd = (u as { cost?: { usd?: unknown } } | undefined)?.cost?.usd
    if (typeof usd === 'number' && Number.isFinite(usd) && usd >= 0) await update($, sessionUsdAt, () => usd)
  } catch { /* no usage: header keeps no figure */ } finally { usdBusy = false }
}

async function gitView($: EngineInterface) {
  const raw: OfficeAgent[] = await read($, office)
  const cwd = await $.session.cwd().catch(() => '')
  await refreshGit($, [cwd, ...raw.map(a => a.cwd)])
  if ((await read($, modeAt)) === 'grouped') refreshAhead($, raw, [gitCache.get(cwd)?.info?.repo ?? cwd])
  const st: { tool?: string; recent?: string[] } = await read($, sessionToolAt)
  const thumbs = await thumbsOn($)
  if (!thumbs) shots.clear()
  else pruneShots(shots, raw)
  return { list: withGit(raw, cwd), sgit: gitCache.get(cwd)?.info, cwd, st, thumbs }
}

// The pane asks for its size: `rows` (inline above the prompt, capped at MAX_INLINE_ROWS so the
// chat is not pushed away) and `columns` (docked beside the transcript). The surface picks the
// seat by itself (no flag forces inline); a request only, and the person's own drag wins.
// compact view: size by its own rendered lines (not the old mind map), 80 columns, capped like the inline pane
async function wantSize($: EngineInterface, list: OfficeAgent[], collapsed: string[], sgit: GitInfo | undefined, st: { tool?: string; recent?: string[] }, thumbs: boolean) {
  if ((await curView($)) !== 'compact') return inlineSize(list, Date.now(), { width: 100, frame: 0, collapsed: new Set(collapsed), project: '', sessionId: '', git: sgit, sessionTool: st, thumbs })
  const caps = await capsOf($)
  const wcols = (await read($, colsAt)) || 80
  const now = Date.now()
  const usd: number | null = await read($, sessionUsdAt)
  const lines = renderCompact(list, now, {
    width: wcols, caps, mode: (await read($, modeAt)) as Mode, query: await read($, queryAt), expanded: new Set(), maxCardRows: 99,
    model: await runModelOf($, list, now), captureIo: await captureIoOf($), sessionUsd: usd ?? undefined, ahead: aheadNow(),
  })
  return { rows: Math.min(40, Math.max(8, lines.length + 1)), columns: wcols }
}
let lastSize = ''
async function openSized($: EngineInterface, focus = false) {
  const { list, sgit, st, thumbs } = await gitView($)
  const collapsed: string[] = await read($, collapsedAt)
  const s = await wantSize($, list, collapsed, sgit, st, thumbs)
  lastSize = `${s.rows}x${s.columns}`
  const r = await $.ui.open({ id: PANE, title: 'Office Agent Monitor', rows: s.rows, columns: s.columns, ...(focus ? { focus: true as const } : {}) })
  undrawn = r.isPlaced ? undefined : r.reason ?? ''
  return r
}

// reopen only when the wanted size really changed
async function resizeIfNeeded($: EngineInterface) {
  if (!(await read($, isOpen))) return
  const { list, sgit, st, thumbs } = await gitView($)
  const collapsed: string[] = await read($, collapsedAt)
  const s = await wantSize($, list, collapsed, sgit, st, thumbs)
  if (`${s.rows}x${s.columns}` !== lastSize) await openSized($)
}

// why the pane waits undrawn (undefined: drawn or closed); isOpen stays true meanwhile so timers and resizes keep working
let undrawn: string | undefined
async function placed($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes().catch(() => [])).some(p => p.id === PANE && p.isPlaced)
}

async function openOffice($: EngineInterface, focus = false) {
  await update($, isOpen, () => true)
  await openSized($, focus)
  await schedule($)
}

async function closeOffice($: EngineInterface) {
  stopTicking()
  shots.clear()
  bg($.ui.status(undefined))
  undrawn = undefined
  await update($, isOpen, () => false)
  await $.ui.close({ id: PANE })
}

async function readUi($: EngineInterface): Promise<Ui> {
  return {
    view: (await curView($)) === 'map' ? 'map' : 'compact', mode: (await read($, modeAt)) as Mode,
    filter: (await read($, filterAt)) === 'failed' ? 'failed' : 'all', sort: (await read($, sortAt)) as Ui['sort'],
    searching: await read($, searchingAt), selected: await read($, selectedAt), attach: await read($, attachAt),
    query: await read($, queryAt), expanded: await read($, expandedAt), modeChosen: await read($, modeChosenAt),
  }
}
async function writeUi($: EngineInterface, n: Ui) {
  await update($, viewAt, () => n.view); await update($, autoViewAt, () => false); await update($, modeAt, () => n.mode); await update($, filterAt, () => n.filter)
  await update($, sortAt, () => n.sort); await update($, searchingAt, () => n.searching); await update($, selectedAt, () => n.selected)
  await update($, attachAt, () => n.attach); await update($, queryAt, () => n.query); await update($, expandedAt, () => n.expanded)
  await update($, modeChosenAt, () => n.modeChosen)
}
// one entry for every button and hotkey: pure reducer, then persist, redraw, keep the keys on the pane
// whether the tree shows a collapsed group right now (decides if g has something to open)
async function groupCtx($: EngineInterface, ui: Ui): Promise<{ collapsed: boolean; workflow: boolean }> {
  const list = (await read($, office)) as OfficeAgent[]
  return { collapsed: treeHasCollapsed(list, Date.now(), { query: ui.query, filter: ui.filter }), workflow: hasWorkflow(list) } // workflow: g only stops there while a run exists
}
async function dispatch($: EngineInterface, a: string) {
  if (a === 'scrollDown' || a === 'scrollUp') {
    // one level (card + bus) per press, clamped to what the last render said is scrollable
    const cur: number = await read($, scrollAt)
    await update($, scrollAt, () => Math.min(scrollInfo.max, Math.max(0, Math.min(cur, scrollInfo.max) + (a === 'scrollDown' ? 8 : -8))))
    $.ui.invalidate('ui.render')
    return
  }
  const ui = await readUi($)
  // a selection that left the list (agent dropped by the 60-entry cap, /office reset) is cleared by the next action, whichever it is
  if (ui.selected && !((await read($, office)) as OfficeAgent[]).some(x => x.id === ui.selected)) ui.selected = ''
  const r = applyAction(ui, a, a === 'group' ? await groupCtx($, ui) : { terminal: onTerminal() })
  if (r.close) return closeOffice($)
  await writeUi($, r.state)
  $.ui.invalidate('ui.render')
  if (a === 'view') bg(resizeIfNeeded($)) // map and compact want different pane sizes
  if (!r.state.searching) bg($.ui.focus({ requestId: PANE, key: 'hk-first' }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'office',
      description: 'Office Agent Monitor (mapa mental de agentes): /office start | stop (alterna sem argumento)',
    })
    // always open at session start: the persisted isOpen is not consulted (a close on session exit
    // left it false). /office stop still closes for the current session only.
    const start = startUi()
    await update($, modeAt, () => start.mode as string)
    await update($, sortAt, () => start.sort)
    await update($, colsAt, () => 0) // a previous /office width does not outlive its session; OFFICE_WIDTH below wins
    // sid fallback: this session's id when the engine gives one, never a previous session's
    const sid = await $.session.id().catch(() => '')
    await update($, sidAt, () => sid || '')
    // the design differs per surface: the terminal opens on the cards (Term5 TELA 8), the app on the map (Proto5).
    // session.start may not carry the surface, so the first render settles it (autoViewAt)
    const surf = (e as { surface?: string }).surface
    await update($, viewAt, () => (surf && !isAppSurface(surf) ? 'compact' : start.view))
    await update($, autoViewAt, () => !surf)
    seenSurface = surf
    await update($, filterAt, () => start.filter)
    await update($, searchingAt, () => start.searching)
    await update($, queryAt, () => start.query)
    await update($, selectedAt, () => start.selected)
    await update($, attachAt, () => start.attach)
    await update($, expandedAt, () => start.expanded)
    await update($, modeChosenAt, () => start.modeChosen)
    await update($, scrollAt, () => 0)
    const m = ((await $.env.get('OFFICE_MODE').catch(() => undefined)) ?? '').trim().toLowerCase()
    if ((MODES as string[]).includes(m)) { await update($, modeAt, () => m); await update($, modeChosenAt, () => true) }
    const vw = ((await $.env.get('OFFICE_VIEW').catch(() => undefined)) ?? '').trim().toLowerCase()
    if (vw === 'map' || vw === 'compact') { await update($, viewAt, () => vw); await update($, autoViewAt, () => false) }
    const w = parseInt((await $.env.get('OFFICE_WIDTH').catch(() => undefined)) ?? '', 10)
    if (w > 0) await update($, colsAt, () => w)
    await openOffice($)
    return next(e)
  })

  on('command.run', { command: 'office' }, async ($, e) => {
    const [w0raw = '', ...restW] = (e.args || '').trim().split(/\s+/)
    const w0 = w0raw.toLowerCase() // like parseSub: /office VIEW map works as /office STOP does
    const arg = restW.join(' ')
    if (w0 === 'view') {
      const want = arg.toLowerCase()
      if (want && !['map', 'compact', 'cards'].includes(want)) return { text: 'Uso: /office view [map|compact] (sem valor alterna).' }
      const cur = await curView($)
      const v = want === 'map' ? 'map' : want ? 'compact' : cur === 'map' ? 'compact' : 'map'
      await update($, viewAt, () => v)
      if (want === 'map' && onTerminal()) await update($, modeAt, () => 'cards') // the terminal's map is the centred cards
      await update($, autoViewAt, () => false) // an explicit choice is never overridden by the surface default
      $.ui.invalidate('ui.render')
      bg(resizeIfNeeded($))
      return { text: `Visão: ${v}.` }
    }
    if (w0 === 'mode' || w0 === 'g') {
      const cur = (await read($, modeAt)) as Mode
      const m = MODES.includes(arg as Mode) ? (arg as Mode) : applyAction({ ...(await readUi($)), mode: cur }, 'group', await groupCtx($, await readUi($))).state.mode
      await update($, modeAt, () => m); await update($, modeChosenAt, () => true); $.ui.invalidate('ui.render'); return { text: `Modo: ${m}.` }
    }
    if (w0 === 'search' || w0 === 'buscar') { await update($, queryAt, () => arg); $.ui.invalidate('ui.render'); return { text: arg ? `Busca: ${arg}` : 'Busca limpa.' } }
    if (w0 === 'open' || w0 === 'detalhe') { await update($, selectedAt, () => arg); await update($, attachAt, () => ''); $.ui.invalidate('ui.render'); return { text: arg ? `Detalhe: ${arg}` : 'Detalhe fechado.' } }
    if (w0 === 'sort' || w0 === 'ordenar') {
      // no or unknown value cycles, like the o hotkey
      const m = ['time', 'state', 'name'].includes(arg) ? arg : applyAction(await readUi($), 'sort').state.sort
      await update($, sortAt, () => m); $.ui.invalidate('ui.render'); return { text: `Ordem: ${m}.` }
    }
    if (w0 === 'filter' || w0 === 'filtro') { const m = arg === 'failed' || arg === 'falhas' ? 'failed' : 'all'; await update($, filterAt, () => m); $.ui.invalidate('ui.render'); return { text: `Filtro: ${m}.` } }
    if (w0 === 'width' || w0 === 'largura') { const n = Math.max(0, Math.min(300, parseInt(arg, 10) || 0)); await update($, colsAt, () => n); if (await read($, isOpen)) await openSized($); return { text: n ? `Largura pedida: ${n} colunas (o terminal limita a 45%).` : 'Largura automatica (80).' } }
    const sub = parseSub(e.args)
    if (sub === 'help') return { text: HELP }
    if (sub === 'collapse') {
      const all: OfficeAgent[] = await read($, office)
      const ids = all.filter(x => all.some(k => k.parentAgentId && k.parentAgentId === x.agentId) || (x.todos ?? []).length > 0).map(x => x.id)
      await update($, collapsedAt, () => ids)
      return { text: 'Ramos recolhidos.' }
    }
    if (sub === 'expand') { await update($, collapsedAt, () => []); return { text: 'Ramos expandidos.' } }
    if (sub === 'status') {
      const all: OfficeAgent[] = await read($, office)
      const open: boolean = await read($, isOpen)
      return { text: statusLines(all, Date.now(), open, open && !(await placed($)) ? (undrawn ?? '') : undefined).join('\n') }
    }
    if (sub === 'reset') {
      if (await read($, isOpen)) return { text: 'Monitor aberto: feche com /office stop antes de resetar.' }
      await update($, office, () => [])
      await update($, collapsedAt, () => [])
      return { text: 'Estado do monitor resetado.' }
    }
    const open = await read($, isOpen)
    const action = sub === 'toggle' ? toggleAction(open, open ? await placed($) : false) : sub
    if (action === 'start') {
      await openOffice($, true)
      return { text: 'Monitor aberto. Feche com /office stop.' }
    }
    await closeOffice($)
    return { text: 'Monitor fechado.' }
  })

  // closed by the person (close mark / Esc): keep state and timers honest
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stopTicking()
      shots.clear()
      bg($.ui.status(undefined))
      undrawn = undefined
      await update($, isOpen, () => false)
    }
    return next(e)
  }).catch(passOn)

  on('agent.spawn', async ($, e, next) => {
    const spawnCwd = (e as { cwd?: string }).cwd
    const isolated = isolatedCalls.has(e.tool_use_id)
    const parentCwd = e.parentAgentId ? (await read($, office) as OfficeAgent[]).find(a => a.agentId === e.parentAgentId)?.cwd : undefined
    // an agent started by a workflow script's agent() carries the run id and its own index (probe 2026-11-05: every agent of
    // one run shares the SAME tool_use_id, so the id must include the index or the cards would merge)
    const wfRaw = (e as { workflow?: { runId?: unknown; agentIndex?: unknown } }).workflow
    const workflow = wfRaw && typeof wfRaw.runId === 'string' && wfRaw.runId.trim() && typeof wfRaw.agentIndex === 'number' && Number.isFinite(wfRaw.agentIndex)
      ? { runId: wfRaw.runId, agentIndex: wfRaw.agentIndex } : undefined
    const entry: OfficeAgent = {
      cwd: spawnCwd ?? (isolated ? undefined : parentCwd ?? (await $.session.cwd().catch(() => ''))) ?? undefined,
      isolated: isolated && !spawnCwd ? true : undefined,
      id: workflow ? `${e.tool_use_id}:${workflow.runId}:${workflow.agentIndex}` : e.tool_use_id || `${Date.now()}-${Math.random()}`,
      workflow,
      parentAgentId: e.parentAgentId,
      description: maskText(e.description ?? ''), // masked before it reaches the state (T-004)
      prompt: firstLine(maskText(e.prompt ?? ''), 300), // masked before it reaches the state (T-004)
      subagentType: e.subagentType,
      status: 'working',
      active: false,
      startedAt: Date.now(),
      seenAt: Date.now(),
    }
    await update($, office, list => [...list, entry].slice(-60))
    bg(schedule($)) // wake to fast rate
    try {
      const res = await next(e)
      const agentId = (res as { agentId?: string }).agentId
      if (agentId) {
        // a fast agent can stop before this resolves (probe 2026-11-05: the workflow SubagentStop carries the spawn's agentId): apply the early stop
        const early = earlyStops.delete(agentId)
        await update($, office, list => list.map(a => (a.id === entry.id ? { ...a, agentId, ...(early && a.status === 'working' ? { status: 'done' as Status, endedAt: Date.now() } : {}) } : a)))
      } else if (workflow) {
        // no agentId: the SubagentStop can never be matched to this workflow agent, so it must not stay active/stalled forever
        await update($, office, list => list.map(a => (a.id === entry.id && a.status === 'working' ? { ...a, status: 'done' as Status, endedAt: Date.now(), endUnknown: true } : a)))
        bg(schedule($))
      }
      return res
    } catch (err) {
      await update($, office, list =>
        list.map(a => (a.id === entry.id ? { ...a, status: 'error' as Status, endedAt: Date.now(), error: errorText(err instanceof Error ? err : new Error(String(err))) } : a)),
      )
      bg(schedule($))
      throw err
    }
  }).catch(passOn)

  // The Agent tool answers `async_launched` at once for a background subagent: that is a launch ack,
  // not the end (SubagentStop is). Only a foreground result finishes the agent, with its real duration.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    // the spawn that this call starts runs inside next(e): mark the worktree request before it
    if (isolatedCall(e as { isolation?: string })) isolatedCalls.add(e.tool_use_id)
    const res = await next(e).finally(() => isolatedCalls.delete(e.tool_use_id))
    const call = e as { model?: string; effort?: string }
    if (call.model || call.effort)
      await update($, office, list => list.map(a => (a.id === e.tool_use_id ? { ...a, model: a.model ?? call.model, effort: a.effort ?? call.effort } : a)))
    const wt = worktreeOf(res)
    if (wt) await update($, office, list => list.map(a => (a.id === e.tool_use_id ? { ...a, cwd: wt.path } : a)))
    if (isLaunchAck(res)) {
      // background: stays "working" until SubagentStop; make sure it carries the id SubagentStop reports
      const aid = launchedAgentId(res)
      if (aid) await update($, office, list => list.map(a => (a.id === e.tool_use_id && !a.agentId ? { ...a, agentId: aid } : a)))
      bg(schedule($))
      return res
    }
    const isError = (res as { isError?: boolean }).isError === true
    const now = Date.now()
    await update($, office, list =>
      list.map(a =>
        a.id === e.tool_use_id && a.status === 'working'
          ? { ...a, status: (isError ? 'error' : 'done') as Status, endedAt: endedAtFrom(a, res, now), error: isError ? errText(res) : undefined }
          : a,
      ),
    )
    bg(schedule($))
    return res
  }).catch(passOn)

  // every tool call feeds its own card: a subagent's record (files, todos, counts, current tool) or the session's
  on('tool.call', async ($, e, next) => {
    const aid = (e as { agentId?: string }).agentId
    const input = e as unknown as Record<string, unknown>
    // current tool shows while the call runs, before its result
    if (aid) await update($, office, list => list.map(a => (a.agentId === aid && a.status === 'working' ? { ...(noteTool(a, e.tool, input) as OfficeAgent), active: true } : a)))
    else await update($, sessionToolAt, cur => {
      const n = noteTool({ id: 's', description: '', status: 'working', startedAt: 0, ...cur }, e.tool, input)
      return { tool: n.tool, recent: n.recent }
    }).then(() => { $.ui.invalidate('ui.render') })
    const startedAt = Date.now()
    const res = await next(e)
    const durationMs = Date.now() - startedAt
    if (aid && (await thumbsOn($))) {
      const shot = shotFrom(e.tool, input, res)
      const owner = shot ? ((await read($, office)) as OfficeAgent[]).find(a => a.agentId === aid && a.status === 'working') : undefined
      if (shot && owner) {
        if (shot.png) shots.set(owner.id, shot.png)
        await update($, office, list => list.map(a => (a.id === owner.id ? { ...a, shot: { host: shot.host ?? a.shot?.host, has: !!shots.get(owner.id) } } : a)))
      }
    }
    if (aid) {
      const ioOn = await captureIoOf($)
      await update($, office, list =>
        list.map(a =>
          a.agentId === aid
            ? (recordSafely({ ...(applyTool(a, e.tool, input, res) as OfficeAgent), seenAt: Date.now() }, () =>
                toolStep((e as { tool_use_id?: string }).tool_use_id ?? `${e.tool}@${startedAt}`, e.tool, toolArgs(input), startedAt, durationMs, res, ioOn),
              ) as OfficeAgent)
            : a,
        ),
      )
    }
    return res
  }).catch(passOn)

  // tokens per agent: each model response of a subagent's loop (turn.step carries its agentId); memory only
  // turn.step streams: chunks pass through (yield*), the response comes back as the stream's result
  on('turn.step', async function* ($, e, next) {
    const res = yield* next(e)
    const aid = (e as { agentId?: string }).agentId
    try {
      const add = usageOf(res) // with or without agentId: the main session's own steps feed the session total
      if (aid && add) await update($, office, list => list.map(a => (a.agentId === aid ? (addUsage(a, add) as OfficeAgent) : a)))
      else if (add) {
        await update($, sessionTokensAt, cur => addSessionTokens(cur ?? undefined, add) ?? null) // main session (no agentId)
        bg(refreshUsd($).then(() => $.ui.invalidate('ui.render')))
      }
    } catch {
      // capture failed: the response is already final and goes on unchanged
    }
    return res
  })

  // main session finished its turn: no tool in use any more
  on('classic.Stop', async ($, e, next) => {
    const sid = (e as { session_id?: string }).session_id
    if (sid) await update($, sidAt, () => sid)
    await update($, sessionToolAt, () => ({}))
    return next(e)
  }).catch(passOn)

  on('classic.SubagentStop', async ($, e, next) => {
    const sid = (e as { session_id?: string }).session_id
    if (sid) await update($, sidAt, () => sid)
    if (e.agent_id && !((await read($, office)) as OfficeAgent[]).some(a => a.agentId === e.agent_id)) { earlyStops.add(e.agent_id); if (earlyStops.size > 100) earlyStops.delete(earlyStops.values().next().value as string) }
    await update($, office, list =>
      list.map(a =>
        a.agentId === e.agent_id && a.status === 'working'
          ? { ...a, status: 'done' as Status, endedAt: Date.now() }
          : a,
      ),
    )
    bg(schedule($))
    return next(e)
  }).catch(passOn)

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e) as unknown as { Box: any; Text: any; Button: any; Input: any; Image?: any } // Image exists on the terminal surface only
    const { Box, Text, Button, Image, Input } = els
    const now = Date.now()
    const { list: all, sgit, st, thumbs } = await gitView($)
    const cols = paneWidth(e.props as { bodyColumns?: number } | undefined, e.viewport)
    const collapsed: string[] = await read($, collapsedAt)
    const cwd = await $.session.cwd().catch(() => '')
    const sessionId = await $.session.id().catch(() => '')
    const capsM = await capsOf($)
    const vocab = { ascii: capsM.ascii, color: capsM.color !== 'mono' } // OFFICE_ASCII / NO_COLOR reach the map too
    const f = renderMonitor(all, now, {
      vocab,
      width: cols, frame: frameFor(all, now), collapsed: new Set(collapsed),
      project: cwd.split('/').filter(Boolean).pop() ?? '', sessionId, git: sgit, sessionTool: st, thumbs,
    })
    const thumb = (t: Thumb) => {
      const png = shots.get(t.id)
      return (
        <Box key={`th-${t.id}`} flexDirection="column" marginRight={2}>
          <Text dimColor>{t.alt.slice(0, t.columns)}</Text>
          {Image && png ? <Image key={`img-${t.id}`} source={{ png }} columns={t.columns} rows={t.rows} alt={t.alt} /> : <Text dimColor>{'sem imagem'}</Text>}
        </Box>
      )
    }
    // a selected id that is not on the map (typo in /office open, agent dropped by the 60-entry cap) means no detail:
    // otherwise the compact view fell through to the map layout with no way back
    const selRaw: string = await read($, selectedAt)
    const selected = selRaw && all.some(a => a.id === selRaw) ? selRaw : ''
    // drawing is pure: the surface default is resolved here and by curView, never written during render
    seenSurface = (e as { surface?: string }).surface ?? 'terminal'
    const view: string = await curView($)
    const caps = await capsOf($)
    const attach: string = await read($, attachAt)
    const sidFallback: string = await read($, sidAt)
    const ioFlag = await captureIoOf($)
    const usd: number | null = await read($, sessionUsdAt)
    const compactView: CView = {
      width: cols, caps, mode: (await read($, modeAt)) as Mode, query: await read($, queryAt),
      filter: (await read($, filterAt)) as 'all' | 'failed', sort: (await read($, sortAt)) as 'time' | 'state' | 'name',
      expanded: new Set((await read($, expandedAt)) as string[]), maxCardRows: 4, scroll: await read($, scrollAt),
      maxLines: ((e.props as { bodyRows?: number } | undefined)?.bodyRows ?? Math.min(e.viewport?.rows ?? 30, 30)) - 9, // header box 3 + Geral 1 + rule and legend 3 + hotkeys 1 + 1 spare
      frame: caps.reducedMotion ? 0 : frameFor(all, now), project: cwd.split('/').filter(Boolean).pop() ?? '', sessionId: sessionId || sidFallback,
      model: await runModelOf($, all, now), captureIo: ioFlag, sessionUsd: usd ?? undefined, ahead: aheadNow(),
      containerPx: canUse(CAPABILITIES, 'containerWidth', 'app') ? (e.viewport as { containerWidth?: number } | undefined)?.containerWidth : undefined,
    }
    // detail screen (view-detail.ts, T-009) for both the compact and the map view; an agent that left the list falls back to the list with a warning
    const detailOf = (id: string) => detailView(all, id, now, { captureIo: ioFlag, ascii: caps.ascii })
    const gone = !!selRaw && !selected
    const goneWarning: typeof f.lines = gone ? [[{ t: detailOf(selRaw).warning ?? '', fg: '#eab308' }]] : []
    let compactFrame: typeof f.lines | undefined
    if (view === 'compact') {
      if (selected && attach) {
        const text = await Promise.resolve($.fs.read(attach)).then(r => (typeof r === 'string' ? r : '[binário]')).catch(() => '[não foi possível ler o arquivo]')
        compactFrame = [[{ t: maskText(attach), bold: true, attach: '' }], ...previewLines(text, attach, 40)]
      } else if (selected) compactFrame = detailOf(selected).lines
      else compactFrame = [...goneWarning, ...renderCompact(all, now, compactView)]
    }
    const detail = selected && view !== 'compact' ? detailOf(selected).lines : undefined
    const act = (a: string) => dispatch($, a)
    const ui = { ...(await readUi($)), selected }
    // card segments are clickable: node -> open that agent's detail, toggle -> expand/collapse its branch
    // (ASCII mode maps every segment, footer and map included, so no non-ASCII glyph reaches the terminal)
    const draw = (line0: typeof f.lines[number]) => { const line = caps.ascii ? asciiLine(line0) : line0; return (
      <Box flexDirection="row">
        {line.map(s =>
          s.attach ? (
            <Button plain key={`a-${s.attach}`} onPress={() => void (async () => { await update($, attachAt, () => s.attach!); $.ui.invalidate('ui.render') })()}><Text color={s.fg}>{s.t}</Text></Button>
          ) : s.act && s.hotkey ? (
            <Button plain hotkey={ui.searching ? undefined : s.hotkey} key={`h-${s.hotkey}`} label={s.t.slice(3)} onPress={() => void act(s.act!)}>{s.t.slice(3)}</Button>
          ) : s.act && s.btn ? (
            <Button variant={s.variant} key={`b-${s.act}`} label={s.t.trim()} onPress={() => void act(s.act!)}>{s.t.trim()}</Button>
          ) : s.act ? (
            <Button plain key={`c-${s.act}-${s.t}`} onPress={() => void act(s.act!)}><Text color={s.fg} bold={s.bold} dimColor={s.dim}>{s.t}</Text></Button>
          ) : s.node && s.hotkey ? (
            <Button plain hotkey={ui.searching ? undefined : s.hotkey} key={`nh-${s.hotkey}`} label={s.t.slice(3)} onPress={() => void act(`open:${s.node!}`)}>{s.t.slice(3)}</Button>
          ) : s.node ? (
            <Button plain key={`n-${s.node}-${s.t}`} onPress={() => void act(`open:${s.node!}`)}><Text color={s.fg} bold={s.bold} dimColor={s.dim}>{s.t}</Text></Button>
          ) : s.toggle ? (
            <Button plain key={`t-${s.toggle}`} onPress={() => void toggleBranch($, s.toggle!)}><Text color={s.fg}>{s.t}</Text></Button>
          ) : (
            <Text color={s.fg} bold={s.bold} dimColor={s.dim}>{s.t}</Text>
          ),
        )}
      </Box>
    ) }
    // largura do container (px): só se a ADR 0002 marcar `containerWidth` como yes no app; hoje não-verificada, então vale a regra de colunas
    const px = canUse(CAPABILITIES, 'containerWidth', 'app') ? (e.viewport as { containerWidth?: number } | undefined)?.containerWidth : undefined
    const side = view === 'compact' && !!selected && !attach && sideDetail({ cols, containerPx: px, desktop: (e as { surface?: string }).surface === 'desktop' })
    // footer hotkeys for the current view (actions.ts): one letter each, none while the search Input has the keys
    // the hint tail is dropped before the row can wrap; then the labels shrink to the bare keys
    const hks = hotkeysFor(ui, side)
    const keysFull = hks.flatMap((h, i) => [...(i ? [{ t: FOOTER_SEP }] : []), { t: `${h.key}: ${h.label}`, act: h.act, hotkey: h.key }])
    const lenOf = (l: { t: string }[]) => l.reduce((k, q) => k + [...q.t].length, 0)
    const tailSeg = { t: footerTail(ui), fg: '#9ca3af' }
    const keysRow = draw(
      lenOf(keysFull) + [...tailSeg.t].length <= cols ? [...keysFull, tailSeg]
        : lenOf(keysFull) <= cols ? keysFull
          : hks.flatMap((h, i) => [...(i ? [{ t: ' ' }] : []), { t: h.key, act: h.act, hotkey: h.key }]),
    )
    // one app card (design Chips5): glyph + title, chips, git, status, progress bar, % and time; border and bar carry the state tone
    const PILL: Record<string, string> = { running: 'Rodando', done: 'Concluído', failed: 'Falhou', attention: 'Aguarda você', pending: 'Na fila', inactive: 'Inativo' }
    // motion on the app surfaces: spinner glyph, a sweeping indeterminate bar and a pulse along the dashed buses (off with reduced motion)
    const fr = caps.reducedMotion ? 0 : frameFor(all, now)
    const glyphOf = (c: AppCard) => (c.state === 'running' && !caps.reducedMotion ? spinnerGlyph(fr, false) : c.glyph)
    const appCardBox = (c: AppCard, kids = false) => (
      <Box key={`app-${c.id}`} flexDirection="column" borderStyle={selected === c.id ? 'double' : 'round'} borderColor={selected && selected !== c.id ? 'subtle' : c.tone} paddingX="sm" width={34}>
        <Box flexDirection="row" justifyContent="space-between">
          {c.id === 'session' ? <Text color={c.tone} bold>{`${glyphOf(c)} ${c.title}${kids ? ' ▾' : ''}`}</Text> : (
            <Button plain key={`app-open-${c.id}`} onPress={() => void act(`open:${c.id}`)}>
              <Text color={c.tone} bold>{`${glyphOf(c)} ${c.title}${kids ? ' ▾' : ''}`}</Text>
            </Button>
          )}
          <Text color={c.tone}>{PILL[c.state] ?? ''}</Text>
        </Box>
        <Text dimColor>{c.chips.join(' · ')}</Text>
        <Box flexDirection="row" justifyContent="space-between">
          {c.git?.length ? <Text color={WORKTREE_COLOR}>{c.git.join(' ')}</Text> : <Text dimColor>{' '}</Text>}
          {c.role ? <Text dimColor>{c.role}</Text> : null}
        </Box>
        {c.steps ? (
          <Box flexDirection="row" height={1} gap="xs">
            {c.steps.map((sg, i) => <Box key={`st-${c.id}-${i}`} flexGrow={sg.weight} height={1} backgroundColor={sg.tone} />)}
          </Box>
        ) : (
          <Box flexDirection="row" height={1} backgroundColor="subtle">
            {c.pct === undefined && fr ? <Box width={`${(fr * 10) % 80}%`} /> : null}
            <Box width={c.pct === undefined ? '30%' : `${Math.round(c.pct * 100)}%`} backgroundColor={c.tone} />
          </Box>
        )}
        <Box flexDirection="row" justifyContent="space-between"><Text dimColor>{c.status ?? ' '}</Text><Text dimColor>{`${c.pctText}  ${c.time}`}</Text></Box>
      </Box>
    )
    // org chart (design Proto5 Mapa): parent card, stub, bus across the children, stub into each child, grandchildren below.
    // Connectors are Boxes (a 1-cell bar), tone `suggestion` into a running child, `subtle` otherwise.
    const APP_CARD_W = 34, APP_GAP = 2
    const perRowApp = Math.max(1, Math.floor((cols - 2 + APP_GAP) / (APP_CARD_W + APP_GAP)))
    const dashes = (key: string, dir: 'row' | 'column', n: number, live = false) => (
      <Box key={key} flexDirection={dir} gap="xs" {...(dir === 'row' ? { height: 1, width: '100%' } : { width: 1 })}>
        {Array.from({ length: n }, (_, i) => <Box key={`dash-${key}-${i}`} flexGrow={1} {...(dir === 'row' ? { height: 1 } : { width: 1 })} backgroundColor={live && !caps.reducedMotion && i === fr % n ? 'suggestion' : 'subtle'} />)}
      </Box>
    )
    const childCol = (k: AppMapNode, i: number, n: number, solid: boolean) => {
      const tone = k.card.state === 'running' ? 'suggestion' : 'subtle'
      return (
        <Box key={`mk-${k.card.id}`} flexDirection="column" alignItems="center">
          {solid ? (
            <Box flexDirection="row" height={1} width="100%">
              <Box width="50%" height={1} backgroundColor={i === 0 ? undefined : 'subtle'} />
              <Box width="50%" height={1} backgroundColor={i === n - 1 ? undefined : 'subtle'} />
            </Box>
          ) : null}
          <Box width={1} height={1} backgroundColor={tone} />
          {mapTree(k, `mt-${k.card.id}`)}
        </Box>
      )
    }
    // org chart (design Proto5 Mapa): parent card, stub, bus across the children, stub into each child, grandchildren below.
    // Same rule as the terminal: one solid bus when the siblings fit one row; otherwise rows of perRowApp cards hang off a
    // dashed trunk on the left, each row under its own dashed bus (user choice), so the rows never read as a frame.
    const mapTree = (n: AppMapNode, key: string): any => {
      const kids = n.children
      const rows: AppMapNode[][] = []
      for (let i = 0; i < kids.length; i += perRowApp) rows.push(kids.slice(i, i + perRowApp))
      return (
        <Box key={key} flexDirection="column" alignItems="center">
          {appCardBox(n.card, kids.length > 0)}
          {kids.length ? <Box width={1} height={1} backgroundColor="subtle" /> : null}
          {rows.length === 1 ? (
            <Box flexDirection="row" justifyContent="center" gap="sm">{rows[0]!.map((k, i) => childCol(k, i, rows[0]!.length, true))}</Box>
          ) : rows.length > 1 ? (
            <Box flexDirection="row" width="100%">
              {dashes(`trunk-${n.card.id}`, 'column', rows.length * 6, kids.some(k => k.card.state === 'running'))}
              <Box flexDirection="column" flexGrow={1} gap="sm">
                {rows.map((row, ri) => (
                  <Box key={`row-${n.card.id}-${ri}`} flexDirection="column">
                    {dashes(`rowbus-${n.card.id}-${ri}`, 'row', 24, row.some(k => k.card.state === 'running'))}
                    <Box flexDirection="row" gap="sm" paddingLeft={1}>{row.map((k, i) => childCol(k, i, row.length, false))}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}
        </Box>
      )
    }
    // side detail (Proto5 aside): crumb, name, pills, segments, Tempo/Tokens/Custo, error, timeline, masked prompt
    const asideOf = (id: string) => {
      const d = detailData(all, id, now)
      if (!d) return null
      const tone = TONE_OF[d.state]
      const seg = d.total ? Array.from({ length: d.total }, (_, i) => i < d.done) : undefined
      return (
        <Box flexDirection="column" gap="xs">
          <Text dimColor>{d.crumb}</Text>
          <Text bold>{d.name}</Text>
          <Box flexDirection="row" flexWrap="wrap" gap="xs">
            {[d.stateLabel, ...d.chips, ...(d.branch ? [d.branch] : [])].map((t, i) => (
              <Box key={`pill-${i}`} borderStyle="round" borderColor={i === 0 ? tone : 'subtle'} paddingX="xs"><Text color={i === 0 ? tone : undefined}>{t}</Text></Box>
            ))}
          </Box>
          <Box flexDirection="row" height={1} gap="xs">
            {(seg ?? [d.state === "done"]).map((lit, i) => <Box key={`ds-${i}`} flexGrow={1} height={1} backgroundColor={lit ? tone : 'subtle'} />)}
          </Box>
          <Box flexDirection="row" justifyContent="space-between">
            {[['Tempo', d.time], ['Tokens', d.tokens], ['Custo', d.cost]].map(([k, v]) => (
              <Box key={`kv-${k}`} flexDirection="column"><Text dimColor>{k}</Text><Text bold>{v}</Text></Box>
            ))}
          </Box>
          {d.error ? <Box borderStyle="round" borderColor="error" paddingX="xs"><Text color="error">{d.error}</Text></Box> : null}
          <Text bold>Linha do tempo</Text>
          {d.steps.length === 0 ? <Text dimColor>—</Text> : d.steps.map((st, i) => (
            <Box key={`tl-${i}`} flexDirection="row" gap="sm">
              <Text dimColor>{st.at}</Text><Text color={st.ok === false ? 'error' : undefined} bold>{st.tool}</Text><Text>{st.label}</Text><Text dimColor>{st.dur}</Text>
            </Box>
          ))}
          <Text bold>Prompt · segredos mascarados</Text>
          <Text dimColor>{d.prompt}</Text>
        </Box>
      )
    }
    // app pane chrome (design Proto5): header, one segment per agent, failure banners, tab row
    const onApp = isAppSurface((e as { surface?: string }).surface)
    const TABS: [string, string, string][] = [['map', 'Mapa', 'tab:map'], ['tree', 'Árvore', 'tab:tree'], ['grouped', 'Worktrees', 'tab:grouped'], ['workflow', 'Workflow', 'tab:workflow'], ['cost', 'Custo', 'tab:cost'], ['tools', 'Ferramentas', 'tab:tools']]
    const curTab = view === 'map' ? 'map' : (await read($, modeAt)) as string
    const appChrome = () => {
      const g = buildGraph(all, now, sgit)
      const ags = [...g.nodes.values()].filter(n => n.kind === 'agent')
      const cnt = (st: string) => ags.filter(n => n.state === st).length
      const proj = cwd.split('/').filter(Boolean).pop() ?? ''
      const failed = appCards(all, now, {}).filter(c => c.state === 'failed')
      return (
        <Box flexDirection="column" gap="xs">
          <Box flexDirection="row" flexWrap="wrap" gap="sm">
            <Text bold>Office</Text>
            <Text dimColor>{`· ${proj}${sgit?.branch ? ` · ⎇ ${sgit.branch}` : ''}`}</Text>
          </Box>
          <Text dimColor>{`${ags.length ? fmtMMSS(elapsedOf(g, now)) : '--:--'} · ${cnt('running')} rodando · ${cnt('done')} concluídos · ${cnt('failed')} falha`}</Text>
          <Box flexDirection="row" flexWrap="wrap" gap="xs">
            {ags.map(n => <Box key={`seg-${n.id}`} width={3} height={1} backgroundColor={TONE_OF[n.state]} />)}
          </Box>
          {failed.map(c => (
            <Box key={`ban-${c.id}`} flexDirection="row" flexWrap="wrap" gap="sm" borderStyle="round" borderColor="error" paddingX="sm">
              <Text color="error" bold>{`✗ ${c.title} falhou`}</Text>
              {c.status ? <Text dimColor>{c.status}</Text> : null}
              <Button plain key={`ban-open-${c.id}`} onPress={() => void act(`open:${c.id}`)}><Text color="error">[Ver]</Text></Button>
            </Box>
          ))}
          <Box flexDirection="row" flexWrap="wrap" gap="sm">
            {TABS.map(([k, label, action]) => (
              <Button plain key={`tab-${k}`} onPress={() => void act(action)}>
                <Text bold={curTab === k} color={curTab === k ? 'suggestion' : undefined} dimColor={curTab !== k} underline={curTab === k}>{label}</Text>
              </Button>
            ))}
          </Box>
        </Box>
      )
    }
    // app surfaces (desktop, vscode, mobile): graphical cards of the Chips design (title, chips, state on border and glyph);
    // the terminal keeps the text cards below. Only the cards view and no detail: the other views stay text.
    if (onApp && view === 'map' && !attach && (!selected || sideDetail({ cols, containerPx: px, desktop: (e as { surface?: string }).surface === 'desktop' }))) {
      const tree = appMap(all, now, { query: await read($, queryAt), filter: (await read($, filterAt)) as 'all' | 'failed', git: sgit })
      const body = tree.card.id === 'session' && tree.children.length === 0 ? <Text dimColor>Aguardando agentes… use o Claude normalmente</Text> : mapTree(tree, 'map-root')
      return (
        <Box flexDirection="column" gap="sm">
          {appChrome()}
          {selected ? (
            <Box flexDirection="row" gap="sm">
              <Box flexDirection="column" flexGrow={1}>{body}</Box>
              <Box flexDirection="column" width={48} borderStyle="round" paddingX={1}>
                <Button key="office-back" onPress={() => void act('back')}>{'[Fechar]'}</Button>
                {asideOf(selected)}
              </Box>
            </Box>
          ) : body}
          {keysRow}
        </Box>
      )
    }
    if (isAppSurface((e as { surface?: string }).surface) && view === 'compact' && !selected && !attach && (await read($, modeAt)) === 'cards') {
      const cards = appCards(all, now, { query: await read($, queryAt), filter: (await read($, filterAt)) as 'all' | 'failed' })
      return (
        <Box flexDirection="column" gap="sm">
          {appChrome()}
          {cards.length === 0 ? <Text dimColor>Aguardando agentes… use o Claude normalmente</Text> : null}
          <Box flexDirection="row" flexWrap="wrap" gap="sm">
            {cards.map(c => appCardBox(c))}
          </Box>
          {keysRow}
        </Box>
      )
    }
    if (compactFrame) {
      const searching = await read($, searchingAt)
      const field = searching ? (
        <Input key="office-search" autoFocus label="s " placeholder="buscar agente (Enter)" value={await read($, queryAt)} onSubmit={(v: string) => void (async () => { await update($, queryAt, () => v.trim()); await dispatch($, 'back') })()} />
      ) : null
      const backBtn = <Button key="office-back" onPress={() => void act('back')}>{attach ? '[← fechar preview]' : '[← voltar]'}</Button>
      // wide pane (desktop app, or a very wide terminal): cards on the left, the detail of the selected agent on the right
      if (side) {
        const left = renderCompact(all, now, { ...compactView, width: cols - 50 })
        return (
          <Box flexDirection="row">
            <Box flexDirection="column" width={cols - 49}>{field}{left.map(draw)}{keysRow}</Box>
            <Box flexDirection="column" width={48} borderStyle="round" paddingX={1}>{backBtn}{detailOf(selected).lines.map(draw)}</Box>
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          {selected || gone ? backBtn : field}
          {compactFrame.map(draw)}
          {keysRow}
        </Box>
      )
    }
    if (detail) {
      return (
        <Box flexDirection="column">
          <Button onPress={() => void act('back')}>{'[← Voltar ao mapa]'}</Button>
          {detail.map(draw)}
          {keysRow}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {gone ? <Button key="office-back-gone" onPress={() => void act('back')}>{'[← voltar]'}</Button> : null}
        {goneWarning.map(draw)}
        {f.header.map(draw)}
        {f.body.map(draw)}
        {f.collapsible.length > 1 ? (
          <Box flexDirection="row">
            <Text dimColor>Ramos: </Text>
            {f.collapsible.slice(0, 8).map(c => (
              <Button key={`br-${c.id}`} onPress={() => void toggleBranch($, c.id)}>{`[${c.hidden ? '+' : '−'} ${c.name.slice(0, 14)}] `}</Button>
            ))}
          </Box>
        ) : null}
        {f.thumbs.length ? (
          <Box flexDirection="row">
            {f.thumbs.map(t => thumb(t))}
          </Box>
        ) : null}
        {keysRow}
      </Box>
    )
  })
}
