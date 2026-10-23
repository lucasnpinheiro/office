import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import type { OfficeAgent, Status } from '../types'
import { frameFor, nextDelay, parseSub, paneWidth, drawSig, ticker } from './office'
import { renderMonitor, inlineSize, detailLines } from './monitor'
import { renderCompact, detailCompact, previewLines, detectCaps, statusText, asciiLine, DEFAULT_MODE } from './compact'
import { applyAction, FOOTER_SEP, footerTail, hotkeysFor, startUi } from './actions'
import type { Ui } from './actions'
import type { Mode, Caps } from './compact'
import type { Thumb } from './monitor'
import { applyTool, noteTool, shotFrom, pruneShots, endedAtFrom, firstLine, isLaunchAck, launchedAgentId, worktreeOf } from './stats'
import { resolveGit } from './git'
import { statusLines } from './status'
import type { GitInfo } from './git'

const PANE = 'agent-office'
const office = atom({ plugin: 'agent-office', key: 'agents' } as const, [])
const isOpen = atom({ plugin: 'agent-office', key: 'open' } as const, false)
const sessionToolAt = atom({ plugin: 'agent-office', key: 'sessionTool' } as const, {})
const collapsedAt = atom({ plugin: 'agent-office', key: 'collapsed' } as const, [])
const selectedAt = atom({ plugin: 'agent-office', key: 'selected' } as const, '')
const viewAt = atom({ plugin: 'agent-office', key: 'view' } as const, 'map')
const modeAt = atom({ plugin: 'agent-office', key: 'mode' } as const, DEFAULT_MODE as string)
const filterAt = atom({ plugin: 'agent-office', key: 'filter' } as const, 'all')
const sortAt = atom({ plugin: 'agent-office', key: 'sort' } as const, 'time')
const colsAt = atom({ plugin: 'agent-office', key: 'cols' } as const, 0)
const sidAt = atom({ plugin: 'agent-office', key: 'sid' } as const, '')
const searchingAt = atom({ plugin: 'agent-office', key: 'searching' } as const, false)
const queryAt = atom({ plugin: 'agent-office', key: 'query' } as const, '')
const expandedAt = atom({ plugin: 'agent-office', key: 'expanded' } as const, [])
const attachAt = atom({ plugin: 'agent-office', key: 'attach' } as const, '')

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
  'Uso: /office start | stop | (alterna). /office view [map|compact] (sem valor alterna); /office mode tree|grouped|cards|waterfall (ou g); /office search <texto> (vazio limpa); /office sort time|state|name; /office filter failed|all; /office width <colunas>; /office open <id> (detalhe). Teclas (com o painel focado: ctrl+x tab ou clique): v mapa/cards, g modo, o ordenar, f só falhas, s buscar, Enter detalhe, b voltar, p/n irmaos no detalhe, q fechar. /office collapse | expand recolhe/expande todos os ramos (ou use os botoes). /office status mostra o resumo; /office reset limpa o estado (monitor fechado). Alias: star.'

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

const errText = (res: unknown): string => {
  const t = (res as { text?: string; content?: unknown })?.text ?? JSON.stringify((res as { content?: unknown })?.content ?? '')
  return String(t).slice(0, 200)
}
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
  const delay = nextDelay(list, Date.now(), { reducedMotion: caps.reducedMotion, compact: (await read($, viewAt)) === 'compact' })
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

async function gitView($: EngineInterface) {
  const raw: OfficeAgent[] = await read($, office)
  const cwd = await $.session.cwd().catch(() => '')
  await refreshGit($, [cwd, ...raw.map(a => a.cwd)])
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
  if ((await read($, viewAt)) !== 'compact') return inlineSize(list, Date.now(), { width: 100, frame: 0, collapsed: new Set(collapsed), project: '', sessionId: '', git: sgit, sessionTool: st, thumbs })
  const caps = await capsOf($)
  const wcols = (await read($, colsAt)) || 80
  const lines = renderCompact(list, Date.now(), { width: wcols, caps, mode: (await read($, modeAt)) as Mode, query: await read($, queryAt), expanded: new Set(), maxCardRows: 6 })
  return { rows: Math.min(40, Math.max(8, lines.length + 1)), columns: wcols }
}
let lastSize = ''
async function openSized($: EngineInterface, focus = false) {
  const { list, sgit, st, thumbs } = await gitView($)
  const collapsed: string[] = await read($, collapsedAt)
  const s = await wantSize($, list, collapsed, sgit, st, thumbs)
  lastSize = `${s.rows}x${s.columns}`
  return $.ui.open({ id: PANE, title: 'Office Agent Monitor', rows: s.rows, columns: s.columns, ...(focus ? { focus: true as const } : {}) })
}

// reopen only when the wanted size really changed
async function resizeIfNeeded($: EngineInterface) {
  if (!(await read($, isOpen))) return
  const { list, sgit, st, thumbs } = await gitView($)
  const collapsed: string[] = await read($, collapsedAt)
  const s = await wantSize($, list, collapsed, sgit, st, thumbs)
  if (`${s.rows}x${s.columns}` !== lastSize) await openSized($)
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
  await update($, isOpen, () => false)
  await $.ui.close({ id: PANE })
}

async function readUi($: EngineInterface): Promise<Ui> {
  return {
    view: (await read($, viewAt)) === 'map' ? 'map' : 'compact', mode: (await read($, modeAt)) as Mode,
    filter: (await read($, filterAt)) === 'failed' ? 'failed' : 'all', sort: (await read($, sortAt)) as Ui['sort'],
    searching: await read($, searchingAt), selected: await read($, selectedAt), attach: await read($, attachAt),
    query: await read($, queryAt), expanded: await read($, expandedAt),
  }
}
async function writeUi($: EngineInterface, n: Ui) {
  await update($, viewAt, () => n.view); await update($, modeAt, () => n.mode); await update($, filterAt, () => n.filter)
  await update($, sortAt, () => n.sort); await update($, searchingAt, () => n.searching); await update($, selectedAt, () => n.selected)
  await update($, attachAt, () => n.attach); await update($, queryAt, () => n.query); await update($, expandedAt, () => n.expanded)
}
// one entry for every button and hotkey: pure reducer, then persist, redraw, keep the keys on the pane
async function dispatch($: EngineInterface, a: string) {
  const r = applyAction(await readUi($), a)
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
    await update($, viewAt, () => start.view)
    await update($, filterAt, () => start.filter)
    await update($, searchingAt, () => start.searching)
    await update($, queryAt, () => start.query)
    await update($, selectedAt, () => start.selected)
    await update($, attachAt, () => start.attach)
    await update($, expandedAt, () => start.expanded)
    const m = ((await $.env.get('OFFICE_MODE').catch(() => undefined)) ?? '').trim().toLowerCase()
    if (['tree', 'grouped', 'cards', 'waterfall'].includes(m)) await update($, modeAt, () => m)
    const vw = ((await $.env.get('OFFICE_VIEW').catch(() => undefined)) ?? '').trim().toLowerCase()
    if (vw === 'map' || vw === 'compact') await update($, viewAt, () => vw)
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
      const cur = await read($, viewAt)
      const v = want === 'map' ? 'map' : want ? 'compact' : cur === 'map' ? 'compact' : 'map'
      await update($, viewAt, () => v)
      $.ui.invalidate('ui.render')
      bg(resizeIfNeeded($))
      return { text: `Visão: ${v}.` }
    }
    if (w0 === 'mode' || w0 === 'g') {
      const cur = (await read($, modeAt)) as Mode
      const m = (['tree', 'grouped', 'cards', 'waterfall'] as Mode[]).includes(arg as Mode) ? (arg as Mode) : applyAction({ ...(await readUi($)), mode: cur }, 'group').state.mode
      await update($, modeAt, () => m); $.ui.invalidate('ui.render'); return { text: `Modo: ${m}.` }
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
      return { text: statusLines(all, Date.now(), open).join('\n') }
    }
    if (sub === 'reset') {
      if (await read($, isOpen)) return { text: 'Monitor aberto: feche com /office stop antes de resetar.' }
      await update($, office, () => [])
      await update($, collapsedAt, () => [])
      return { text: 'Estado do monitor resetado.' }
    }
    const open = await read($, isOpen)
    const action = sub === 'toggle' ? (open ? 'stop' : 'start') : sub
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
      await update($, isOpen, () => false)
    }
    return next(e)
  }).catch(passOn)

  on('agent.spawn', async ($, e, next) => {
    const spawnCwd = (e as { cwd?: string }).cwd
    const isolated = (e as { isolation?: string }).isolation === 'worktree'
    const parentCwd = e.parentAgentId ? (await read($, office) as OfficeAgent[]).find(a => a.agentId === e.parentAgentId)?.cwd : undefined
    const entry: OfficeAgent = {
      cwd: spawnCwd ?? (isolated ? undefined : parentCwd ?? (await $.session.cwd().catch(() => ''))) ?? undefined,
      isolated: isolated && !spawnCwd ? true : undefined,
      id: e.tool_use_id || `${Date.now()}-${Math.random()}`,
      parentAgentId: e.parentAgentId,
      description: e.description,
      prompt: firstLine(e.prompt, 300),
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
        await update($, office, list => list.map(a => (a.id === entry.id ? { ...a, agentId } : a)))
      }
      return res
    } catch (err) {
      await update($, office, list =>
        list.map(a => (a.id === entry.id ? { ...a, status: 'error' as Status, endedAt: Date.now(), error: String((err as Error)?.message ?? err).slice(0, 200) } : a)),
      )
      bg(schedule($))
      throw err
    }
  }).catch(passOn)

  // The Agent tool answers `async_launched` at once for a background subagent: that is a launch ack,
  // not the end (SubagentStop is). Only a foreground result finishes the agent, with its real duration.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const res = await next(e)
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
    const res = await next(e)
    if (aid && (await thumbsOn($))) {
      const shot = shotFrom(e.tool, input, res)
      const owner = shot ? ((await read($, office)) as OfficeAgent[]).find(a => a.agentId === aid && a.status === 'working') : undefined
      if (shot && owner) {
        if (shot.png) shots.set(owner.id, shot.png)
        await update($, office, list => list.map(a => (a.id === owner.id ? { ...a, shot: { host: shot.host ?? a.shot?.host, has: !!shots.get(owner.id) } } : a)))
      }
    }
    if (aid) {
      await update($, office, list =>
        list.map(a => (a.agentId === aid ? { ...(applyTool(a, e.tool, input, res) as OfficeAgent), seenAt: Date.now() } : a)),
      )
    }
    return res
  }).catch(passOn)

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
    const f = renderMonitor(all, now, {
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
    const view: string = await read($, viewAt)
    const caps = await capsOf($)
    const attach: string = await read($, attachAt)
    const sidFallback: string = await read($, sidAt)
    const compactView = {
      width: cols, caps, mode: (await read($, modeAt)) as Mode, query: await read($, queryAt),
      filter: (await read($, filterAt)) as 'all' | 'failed', sort: (await read($, sortAt)) as 'time' | 'state' | 'name',
      expanded: new Set((await read($, expandedAt)) as string[]), maxCardRows: 4,
      maxLines: ((e.props as { bodyRows?: number } | undefined)?.bodyRows ?? Math.min(e.viewport?.rows ?? 30, 30)) - 12,
      frame: caps.reducedMotion ? 0 : frameFor(all, now), project: cwd.split('/').filter(Boolean).pop() ?? '', sessionId: sessionId || sidFallback,
    }
    let compactFrame: typeof f.lines | undefined
    if (view === 'compact') {
      if (selected && attach) {
        const text = await Promise.resolve($.fs.read(attach)).then(r => (typeof r === 'string' ? r : '[binário]')).catch(() => '[não foi possível ler o arquivo]')
        compactFrame = [[{ t: attach, bold: true, attach: '' }], ...previewLines(text, attach, 40)]
      } else if (selected) compactFrame = detailCompact(all, selected, now, caps)
      else compactFrame = renderCompact(all, now, compactView)
    }
    const detail = selected && view !== 'compact' ? detailLines(all, selected, now) : undefined
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
    const side = view === 'compact' && !!selected && !attach && cols >= ((e as { surface?: string }).surface === 'desktop' ? 110 : 150)
    // footer hotkeys for the current view (actions.ts): one letter each, none while the search Input has the keys
    const keysRow = draw([
      ...hotkeysFor(ui, side).flatMap((h, i) => [...(i ? [{ t: FOOTER_SEP }] : []), { t: `${h.key}: ${h.label}`, act: h.act, hotkey: h.key }]),
      { t: footerTail(ui), fg: '#9ca3af' },
    ])
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
            <Box flexDirection="column" width={48} borderStyle="round" paddingX={1}>{backBtn}{(detailCompact(all, selected, now, caps) ?? []).map(draw)}</Box>
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          {selected ? backBtn : field}
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
        {f.footer.map(draw)}
        {keysRow}
      </Box>
    )
  })
}
