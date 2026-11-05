import { test, expect } from 'claude-code/testing'
import { parseHead, resolveGit, worktreeFromPath, gitLabel, aheadOf, cachedAhead, AHEAD_TTL_MS } from './git'
import type { ProcessRun } from './git'

// T-007 AC-023: `+N commits` só com $.process provado (probe 2026-11-05, ADR 0002): rev-parse @{upstream} ou origin/HEAD
// dá a base, rev-list --count base..HEAD a contagem; qualquer falha, saída estranha ou 2 s a mais omite tudo.
const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '' })
const scripted = (table: Record<string, { exitCode: number; stdout: string } | 'throw' | 'hang'>): ProcessRun => async argv => {
  const hit = table[argv.slice(1).join(' ')]
  if (hit === 'throw') throw new Error('boom')
  if (hit === 'hang') return new Promise(() => undefined)
  return hit ?? { exitCode: 128, stdout: '' }
}
const UP = 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}'
const ORIGIN = 'symbolic-ref --short refs/remotes/origin/HEAD'

test('aheadOf: base do upstream e contagem de rev-list', async () => {
  const run = scripted({ [UP]: ok('origin/main\n'), 'rev-list --count origin/main..HEAD': ok('6\n') })
  expect(await aheadOf(run, '/wt')).toEqual({ base: 'origin/main', ahead: 6 })
})

test('aheadOf: sem upstream, usa origin/HEAD', async () => {
  const run = scripted({ [ORIGIN]: ok('origin/main'), 'rev-list --count origin/main..HEAD': ok('2') })
  expect(await aheadOf(run, '/wt')).toEqual({ base: 'origin/main', ahead: 2 })
})

test('aheadOf: zero real é zero (a base existe e nada à frente), não omitido', async () => {
  const run = scripted({ [UP]: ok('origin/main'), 'rev-list --count origin/main..HEAD': ok('0') })
  expect(await aheadOf(run, '/wt')).toEqual({ base: 'origin/main', ahead: 0 })
})

test('AC-023 aheadOf: sem base conhecida, omite', async () => {
  expect(await aheadOf(scripted({}), '/wt')).toBeUndefined()
})

test('AC-023 aheadOf: $.process ausente, git falha, saída não numérica ou exceção omitem', async () => {
  expect(await aheadOf(undefined, '/wt')).toBeUndefined()
  expect(await aheadOf(scripted({ [UP]: ok('origin/main'), 'rev-list --count origin/main..HEAD': { exitCode: 128, stdout: '5' } }), '/wt')).toBeUndefined()
  expect(await aheadOf(scripted({ [UP]: ok('origin/main'), 'rev-list --count origin/main..HEAD': ok('abc') }), '/wt')).toBeUndefined()
  expect(await aheadOf(scripted({ [UP]: 'throw', [ORIGIN]: 'throw' }), '/wt')).toBeUndefined()
  expect(await aheadOf(scripted({ [UP]: ok('--delete-me; rm') }), '/wt')).toBeUndefined() // base que parece opção/shell não vai ao argv
})

test('AC-023 aheadOf: passou do limite de tempo, omite (não trava o painel)', async () => {
  const t0 = Date.now()
  expect(await aheadOf(scripted({ [UP]: 'hang' }), '/wt', 50)).toBeUndefined()
  expect(Date.now() - t0).toBeLessThan(1000)
})

test('AC-023 cachedAhead: 30 s de cache por worktree, inclusive para falha; sem chamadas em paralelo', async () => {
  const cache = new Map()
  let calls = 0
  const load = async () => { calls++; return undefined }
  await cachedAhead(cache, '/wt', 1000, load)
  await cachedAhead(cache, '/wt', 1000 + AHEAD_TTL_MS - 1, load)
  expect(calls).toBe(1) // falha também fica em cache: git quebrado não custa 2 s a cada quadro
  await cachedAhead(cache, '/wt', 1000 + AHEAD_TTL_MS, load)
  expect(calls).toBe(2)
  let release!: () => void
  const slow = () => new Promise<undefined>(r => { release = () => r(undefined); calls++ })
  const p1 = cachedAhead(cache, '/outro', 0, slow)
  await cachedAhead(cache, '/outro', 1, slow)
  expect(calls).toBe(3) // a segunda chamada viu a primeira em andamento
  release(); await p1
})

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
