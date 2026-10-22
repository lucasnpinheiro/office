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

// Card lines: "⎇ branch" then, in a linked worktree, "⧉ name" on its own line (the card is narrow).
// A repo other than the session's is prefixed ("repo:branch"). undefined when there is nothing to show.
export function gitLabel(g: GitInfo | undefined, sessionRepo?: string): string[] | undefined {
  if (!g || (!g.branch && !g.worktree)) return undefined
  const other = g.repo && sessionRepo && g.repo !== sessionRepo ? `${basename(g.repo)}:` : ''
  return [`⎇ ${other}${g.branch ?? '?'}`, ...(g.worktree ? [`⧉ ${g.worktree}`] : [])]
}
