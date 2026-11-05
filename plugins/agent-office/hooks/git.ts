// Branch / worktree of a directory, read from .git files (no git process). Pure: the file access is injected.
export type GitInfo = { branch?: string; worktree?: string; repo?: string }
export type GitFs = { read: (p: string) => Promise<string>; exists: (p: string) => Promise<boolean> }

const dirname = (p: string) => p.replace(/\/+$/, '').replace(/\/[^/]*$/, '') || '/'
const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? p

function normalize(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '..') out.pop()
    else if (seg && seg !== '.') out.push(seg)
  }
  return '/' + out.join('/')
}

// "ref: refs/heads/x" -> x ; a bare sha (detached HEAD) -> its 7-char prefix.
export function parseHead(text: string): string | undefined {
  const t = (text ?? '').trim()
  if (!t) return undefined
  const m = /^ref:\s*refs\/heads\/(.+)$/.exec(t)
  if (m) return m[1]
  if (t.startsWith('ref:')) return t.slice(4).trim().split('/').pop()
  return /^[0-9a-f]{7,40}$/i.test(t) ? t.slice(0, 7) : undefined
}

// Walks up from `cwd` to the nearest .git: a directory (plain repo) or a file `gitdir: ...` (linked worktree).
export async function resolveGit(fs: GitFs, cwd: string): Promise<GitInfo | undefined> {
  let dir = normalize(cwd || '/')
  for (let i = 0; i < 40; i++) {
    const dot = `${dir === '/' ? '' : dir}/.git`
    if (await fs.exists(dot).catch(() => false)) {
      try {
        return { branch: parseHead(await fs.read(`${dot}/HEAD`)), repo: dir }
      } catch { /* a file, not a directory: linked worktree */ }
      try {
        const m = /^gitdir:\s*(.+)$/m.exec(await fs.read(dot))
        if (!m) return undefined
        const gitdir = m[1]!.trim().startsWith('/') ? normalize(m[1]!.trim()) : normalize(`${dir}/${m[1]!.trim()}`)
        const branch = parseHead(await fs.read(`${gitdir}/HEAD`).catch(() => ''))
        const common = await fs.read(`${gitdir}/commondir`).then(t => normalize(`${gitdir}/${t.trim()}`)).catch(() => '')
        // no commondir = a submodule's gitdir, not a worktree
        return common ? { branch, worktree: basename(gitdir), repo: dirname(common) } : { branch, repo: dir }
      } catch { return undefined }
    }
    if (dir === '/') return undefined
    dir = dirname(dir)
  }
  return undefined
}

// Root of a Claude worktree (`<repo>/.claude/worktrees/<name>`) inside any file path.
export function worktreeFromPath(p: string): string | undefined {
  return /^(.*\/\.claude\/worktrees\/[^/]+)/.exec(p ?? '')?.[1]
}

// ---------- commits à frente (T-007, AC-023) ----------
// Só com `$.process` (CLI), provado por probe em 2026-11-05 (ADR 0002): `rev-parse @{upstream}` / `symbolic-ref origin/HEAD`
// dão a base, `rev-list --count base..HEAD` a contagem. Falha, saída estranha ou mais de 2 s = sem contagem (nunca zero).
export type ProcessRun = (argv: readonly string[], init?: { cwd?: string; timeoutMs?: number }) => Promise<{ exitCode: number; stdout: string; stderr?: string }>
export type AheadInfo = { base: string; ahead: number }
export const AHEAD_TTL_MS = 30_000
export const AHEAD_TIMEOUT_MS = 2000
const SAFE_REF = /^[A-Za-z0-9][\w./-]*$/ // a ref nunca começa com "-" (não vira opção do git) e não tem espaço nem shell

export async function aheadOf(run: ProcessRun | undefined, cwd: string, timeoutMs = AHEAD_TIMEOUT_MS): Promise<AheadInfo | undefined> {
  if (typeof run !== 'function' || !cwd) return undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<undefined>(r => { timer = setTimeout(() => r(undefined), timeoutMs) })
  const git = async (...args: string[]): Promise<string | undefined> => {
    const r = await run(['git', ...args], { cwd, timeoutMs }).catch(() => undefined)
    return r && r.exitCode === 0 ? String(r.stdout).trim() : undefined
  }
  const work = (async (): Promise<AheadInfo | undefined> => {
    const base = (await git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')) ?? (await git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD'))
    if (!base || !SAFE_REF.test(base)) return undefined
    const n = await git('rev-list', '--count', `${base}..HEAD`)
    return n !== undefined && /^\d+$/.test(n) ? { base, ahead: Number(n) } : undefined
  })()
  try { return await Promise.race([work, limit]) } finally { if (timer) clearTimeout(timer) }
}

export type AheadCache = Map<string, { at: number; info?: AheadInfo; pending?: boolean }>
// One lookup per key every AHEAD_TTL_MS, failures included (a broken git must not cost 2 s on every frame); none while one is in flight.
export async function cachedAhead(cache: AheadCache, key: string, now: number, load: () => Promise<AheadInfo | undefined>): Promise<AheadInfo | undefined> {
  const hit = cache.get(key)
  if (hit && (hit.pending || now - hit.at < AHEAD_TTL_MS)) return hit.info
  cache.set(key, { at: now, info: hit?.info, pending: true })
  const info = await load().catch(() => undefined)
  cache.set(key, { at: now, info })
  return info
}

// Card lines: "⎇ branch" then, in a linked worktree, "⧉ name" on its own line (the card is narrow).
// A repo other than the session's is prefixed ("repo:branch"). undefined when there is nothing to show.
export function gitLabel(g: GitInfo | undefined, sessionRepo?: string): string[] | undefined {
  if (!g || (!g.branch && !g.worktree)) return undefined
  const other = g.repo && sessionRepo && g.repo !== sessionRepo ? `${basename(g.repo)}:` : ''
  return [`⎇ ${other}${g.branch ?? '?'}`, ...(g.worktree ? [`⧉ ${g.worktree}`] : [])]
}
