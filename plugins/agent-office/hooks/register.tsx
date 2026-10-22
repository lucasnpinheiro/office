import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface } from 'claude-code'
import type { OfficeAgent } from '../types'
import { frameFor, nextDelay, parseSub, paneWidth, drawSig } from './office'
import { renderMonitor, inlineSize, detailLines } from './monitor'
import { renderCompact, detailCompact, previewLines, detectCaps, statusText, NEXT_MODE, DEFAULT_MODE } from './compact'
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
const viewAt = atom({ plugin: 'agent-office', key: 'view' } as const, 'compact')
const modeAt = atom({ plugin: 'agent-office', key: 'mode' } as const, DEFAULT_MODE as string)
const searchingAt = atom({ plugin: 'agent-office', key: 'searching' } as const, false)
const queryAt = atom({ plugin: 'agent-office', key: 'query' } as const, '')
const expandedAt = atom({ plugin: 'agent-office', key: 'expanded' } as const, [])
const attachAt = atom({ plugin: 'agent-office', key: 'attach' } as const, '')

// Terminal capabilities from the environment (ASCII, color depth, reduced motion). Cached for the session.
let capsCache: Caps | undefined
async function capsOf($: EngineInterface, surface?: string): Promise<Caps> {
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
  capsCache = detectCaps(env, { isTTY: surface === 'terminal' || surface === undefined ? true : true })
  return capsCache
}

const HELP =
  'Uso: /office start | stop | (alterna). /office view map|compact; /office mode tree|grouped|cards|waterfall (ou g); /office search <texto> (vazio limpa); /office open <id> (detalhe). Teclas/botoes: g modo, / buscar, Enter detalhe, Esc/voltar, [ ] irmaos. /office collapse | expand recolhe/expande todos os ramos (ou use os botoes). /office status mostra o resumo; /office reset limpa o estado (monitor fechado). Alias: star.'

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

function stopTicking() {
  if (timer) timer.cancel()
  timer = undefined
}

// one redraw timer at most; self-rescheduling so the rate follows activity
async function schedule($: EngineInterface) {
  stopTicking()
  if (!(await read($, isOpen))) return
  const list: OfficeAgent[] = await read($, office)
  void resizeIfNeeded($)
  const caps = await capsOf($)
  void $.ui.status(statusText(list, Date.now(), caps.ascii))
  const delay = nextDelay(list, Date.now(), { reducedMotion: caps.reducedMotion, compact: (await read($, viewAt)) === 'compact' })
  if (delay === undefined) return // nothing running: no animation, no timer
  timer = $.clock.after(delay, () => {
    timer = undefined
    void (async () => {
      const sig = drawSig(await read($, office), Date.now())
      if (sig !== lastSig) { lastSig = sig; $.ui.invalidate('ui.render') } // same frame + data: nothing to redraw
      void schedule($)
    })()
  })
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
  const lines = renderCompact(list, Date.now(), { width: 80, caps, mode: (await read($, modeAt)) as Mode, query: await read($, queryAt), expanded: new Set(), maxCardRows: 6 })
  return { rows: Math.min(40, Math.max(8, lines.length + 1)), columns: 80 }
}
let lastSize = ''
async function openSized($: EngineInterface) {
  const { list, sgit, st, thumbs } = await gitView($)
  const collapsed: string[] = await read($, collapsedAt)
  const s = await wantSize($, list, collapsed, sgit, st, thumbs)
  lastSize = `${s.rows}x${s.columns}`
  return $.ui.open({ id: PANE, title: 'Office Agent Monitor', rows: s.rows, columns: s.columns })
}

// reopen only when the wanted size really changed
async function resizeIfNeeded($: EngineInterface) {
  if (!(await read($, isOpen))) return
  const { list, sgit, st, thumbs } = await gitView($)
  const collapsed: string[] = await read($, collapsedAt)
  const s = await wantSize($, list, collapsed, sgit, st, thumbs)
  if (`${s.rows}x${s.columns}` !== lastSize) await openSized($)
}

async function openOffice($: EngineInterface) {
  await update($, isOpen, () => true)
  await openSized($)
  await schedule($)
}

async function closeOffice($: EngineInterface) {
  stopTicking()
  shots.clear()
  void $.ui.status(undefined)
  await update($, isOpen, () => false)
  await $.ui.close({ id: PANE })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'office',
      description: 'Office Agent Monitor (mapa mental de agentes): /office start | stop (alterna sem argumento)',
    })
    // always open at session start: the persisted isOpen is not consulted (a close on session exit
    // left it false). /office stop still closes for the current session only.
    await openOffice($)
    return next(e)
  })

  on('command.run', { command: 'office' }, async ($, e) => {
    const [w0 = '', ...restW] = (e.args || '').trim().split(/\s+/)
    const arg = restW.join(' ')
    if (w0 === 'view') { const v = arg === 'map' ? 'map' : 'compact'; await update($, viewAt, () => v); return { text: `Visão: ${v}.` } }
    if (w0 === 'mode' || w0 === 'g') {
      const cur = (await read($, modeAt)) as Mode
      const m = (['tree', 'grouped', 'cards', 'waterfall'] as Mode[]).includes(arg as Mode) ? (arg as Mode) : NEXT_MODE[cur]
      await update($, modeAt, () => m); $.ui.invalidate('ui.render'); return { text: `Modo: ${m}.` }
    }
    if (w0 === 'search' || w0 === 'buscar') { await update($, queryAt, () => arg); $.ui.invalidate('ui.render'); return { text: arg ? `Busca: ${arg}` : 'Busca limpa.' } }
    if (w0 === 'open' || w0 === 'detalhe') { await update($, selectedAt, () => arg); await update($, attachAt, () => ''); $.ui.invalidate('ui.render'); return { text: arg ? `Detalhe: ${arg}` : 'Detalhe fechado.' } }
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
      await openOffice($)
      return { text: 'Monitor aberto. Feche com /office stop.' }
    }
    await closeOffice($)
    return { text: 'Monitor fechado.' }
  })

  // closed by the person (close mark / Esc): keep state and timers honest
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stopTicking()
      await update($, isOpen, () => false)
    }
    return next(e)
  })

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
      startedAt: Date.now(),
      seenAt: Date.now(),
    }
    await update($, office, list => [...list, entry].slice(-60))
    void schedule($) // wake to fast rate
    try {
      const res = await next(e)
      const agentId = (res as { agentId?: string }).agentId
      if (agentId) {
        await update($, office, list => list.map(a => (a.id === entry.id ? { ...a, agentId } : a)))
      }
      return res
    } catch (err) {
      await update($, office, list =>
        list.map(a => (a.id === entry.id ? { ...a, status: 'error', endedAt: Date.now(), error: String((err as Error)?.message ?? err).slice(0, 200) } : a)),
      )
      void schedule($)
      throw err
    }
  })

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
      void schedule($)
      return res
    }
    const isError = (res as { isError?: boolean }).isError === true
    const now = Date.now()
    await update($, office, list =>
      list.map(a =>
        a.id === e.tool_use_id && a.status === 'working'
          ? { ...a, status: isError ? 'error' : 'done', endedAt: endedAtFrom(a, res, now), error: isError ? errText(res) : undefined }
          : a,
      ),
    )
    void schedule($)
    return res
  })

  // every tool call feeds its own card: a subagent's record (files, todos, counts, current tool) or the session's
  on('tool.call', async ($, e, next) => {
    const aid = (e as { agentId?: string }).agentId
    const input = e as unknown as Record<string, unknown>
    // current tool shows while the call runs, before its result
    if (aid) await update($, office, list => list.map(a => (a.agentId === aid && a.status === 'working' ? noteTool(a, e.tool, input) as OfficeAgent : a)))
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
  })

  // main session finished its turn: no tool in use any more
  on('classic.Stop', async ($, e, next) => {
    await update($, sessionToolAt, () => ({}))
    return next(e)
  })

  on('classic.SubagentStop', async ($, e, next) => {
    await update($, office, list =>
      list.map(a =>
        a.agentId === e.agent_id && a.status === 'working'
          ? { ...a, status: 'done', endedAt: Date.now() }
          : a,
      ),
    )
    void schedule($)
    return next(e)
  })

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
    const selected: string = await read($, selectedAt)
    const view: string = await read($, viewAt)
    const caps = await capsOf($, (e as { surface?: string }).surface)
    const attach: string = await read($, attachAt)
    let compactFrame: typeof f.lines | undefined
    if (view === 'compact') {
      if (selected && attach) {
        const text = await Promise.resolve($.fs.read(attach)).then(r => (typeof r === 'string' ? r : '[binário]')).catch(() => '[não foi possível ler o arquivo]')
        compactFrame = [[{ t: attach, bold: true, attach: '' }], ...previewLines(text, attach, 40)]
      } else if (selected) compactFrame = detailCompact(all, selected, now, caps)
      else compactFrame = renderCompact(all, now, {
        width: cols, caps, mode: (await read($, modeAt)) as Mode, query: await read($, queryAt),
        expanded: new Set((await read($, expandedAt)) as string[]), maxCardRows: 4, maxLines: ((e.props as { bodyRows?: number } | undefined)?.bodyRows ?? Math.min(e.viewport?.rows ?? 30, 30)) - 11, frame: caps.reducedMotion ? 0 : frameFor(all, now), project: cwd.split('/').filter(Boolean).pop() ?? '', sessionId,
      })
    }
    const detail = selected && view !== 'compact' ? detailLines(all, selected, now) : undefined
    const act = async (a: string) => {
      if (a === 'group') { const cur = (await read($, modeAt)) as Mode; await update($, modeAt, () => NEXT_MODE[cur]) }
      else if (a === 'view') await update($, viewAt, () => 'map')
      else if (a === 'search') await update($, searchingAt, x => !x)
      else if (a.startsWith('grp:')) await update($, expandedAt, l => (l.includes(a.slice(4)) ? l.filter(x => x !== a.slice(4)) : [...l, a.slice(4)]))
    }
    // card segments are clickable: node -> open that agent's detail, toggle -> expand/collapse its branch
    const draw = (line: typeof f.lines[number]) => (
      <Box flexDirection="row">
        {line.map(s =>
          s.attach ? (
            <Button plain key={`a-${s.attach}`} onPress={() => void update($, attachAt, () => s.attach!)}><Text color={s.fg}>{s.t}</Text></Button>
          ) : s.act ? (
            <Button plain key={`c-${s.act}-${s.t}`} onPress={() => void act(s.act!)}><Text color={s.fg} bold={s.bold} dimColor={s.dim}>{s.t}</Text></Button>
          ) : s.node ? (
            <Button plain key={`n-${s.node}-${s.t}`} onPress={() => void update($, selectedAt, () => s.node!)}><Text color={s.fg} bold={s.bold} dimColor={s.dim}>{s.t}</Text></Button>
          ) : s.toggle ? (
            <Button plain key={`t-${s.toggle}`} onPress={() => void toggleBranch($, s.toggle!)}><Text color={s.fg}>{s.t}</Text></Button>
          ) : (
            <Text color={s.fg} bold={s.bold} dimColor={s.dim}>{s.t}</Text>
          ),
        )}
      </Box>
    )
    if (compactFrame) {
      const back = () => void (attach ? update($, attachAt, () => '') : update($, selectedAt, () => ''))
      return (
        <Box flexDirection="column">
          {selected ? <Button onPress={back}>{attach ? '[← Esc: fechar preview]' : '[← Esc: voltar]'}</Button> : !(await read($, searchingAt)) ? null : (
            <Input key="office-search" label="/ " placeholder="buscar agente (Enter)" value={await read($, queryAt)} onSubmit={(v: string) => { void update($, queryAt, () => v.trim()); void update($, searchingAt, () => false) }} />
          )}
          {compactFrame.map(draw)}
        </Box>
      )
    }
    if (detail) {
      return (
        <Box flexDirection="column">
          <Button onPress={() => void update($, selectedAt, () => '')}>{'[← Voltar ao mapa]'}</Button>
          {detail.map(draw)}
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
      </Box>
    )
  })
}
