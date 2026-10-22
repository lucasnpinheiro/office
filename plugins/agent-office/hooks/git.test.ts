import { test, expect } from 'claude-code/testing'
import { parseHead, resolveGit, worktreeFromPath, gitLabel } from './git'

const fake = (files: Record<string, string>) => ({
  read: async (p: string) => { if (p in files) return files[p]!; throw new Error('ENOENT ' + p) },
  exists: async (p: string) => p in files || Object.keys(files).some(k => k.startsWith(p + '/')),
})

test('parseHead: branch, detached sha, junk', () => {
  expect(parseHead('ref: refs/heads/feat/x\n')).toBe('feat/x')
  expect(parseHead('0123456789abcdef0123456789abcdef01234567\n')).toBe('0123456')
  expect(parseHead('')).toBeUndefined()
})

test('resolveGit: plain repo found walking up from a subdir', async () => {
  const fs = fake({ '/r/app/.git/HEAD': 'ref: refs/heads/main\n' })
  expect(await resolveGit(fs, '/r/app/src/deep')).toEqual({ branch: 'main', repo: '/r/app' })
})

test('resolveGit: worktree via .git file + commondir groups under the main repo', async () => {
  const fs = fake({
    '/r/app/.claude/worktrees/wt-1/.git': 'gitdir: /r/app/.git/worktrees/wt-1\n',
    '/r/app/.git/worktrees/wt-1/HEAD': 'ref: refs/heads/worktree-wt-1\n',
    '/r/app/.git/worktrees/wt-1/commondir': '../..\n',
  })
  expect(await resolveGit(fs, '/r/app/.claude/worktrees/wt-1/src')).toEqual({ branch: 'worktree-wt-1', worktree: 'wt-1', repo: '/r/app' })
})

test('resolveGit: detached HEAD in worktree; non-git dir yields undefined', async () => {
  const fs = fake({
    '/w/.git': 'gitdir: /r/.git/worktrees/w\n',
    '/r/.git/worktrees/w/HEAD': 'abcdef0123456789abcdef0123456789abcdef01\n',
    '/r/.git/worktrees/w/commondir': '../..',
  })
  expect((await resolveGit(fs, '/w'))?.branch).toBe('abcdef0')
  expect(await resolveGit(fake({}), '/nowhere/x')).toBeUndefined()
})

test('worktreeFromPath finds the worktree root inside a file path', () => {
  expect(worktreeFromPath('/r/app/.claude/worktrees/wt-9/src/a.php')).toBe('/r/app/.claude/worktrees/wt-9')
  expect(worktreeFromPath('/r/app/src/a.php')).toBeUndefined()
})

test('gitLabel: branch + worktree, other repo prefixed, undefined when nothing', () => {
  expect(gitLabel({ branch: 'main', repo: '/r/app' }, '/r/app')).toEqual(['⎇ main'])
  expect(gitLabel({ branch: 'f', worktree: 'wt', repo: '/r/app' }, '/r/app')).toEqual(['⎇ f', '⧉ wt'])
  expect(gitLabel({ branch: 'dev', repo: '/r/other' }, '/r/app')).toEqual(['⎇ other:dev'])
  expect(gitLabel(undefined, '/r/app')).toBeUndefined()
})
