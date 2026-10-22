#!/usr/bin/env node
// claude-office installer: a thin wrapper over the `claude plugin` CLI.
// It never edits settings.json by hand; marketplace and plugin state go through the CLI.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'lucasnpinheiro/office'
const MARKET = 'office'
const MIN_CLAUDE = [2, 1, 300] // UNVERIFIED lower bound: the mod API was developed against 2.1.306
const CAVEMAN_URL = 'https://github.com/JuliusBrussee/caveman'
const LAYA_URL = 'https://github.com/lucasnpinheiro/laya'
const PLUGINS = ['agent-office', 'personas', 'learning', 'laya']

const HELP = `claude-office - install the Office mod and optional parts into Claude Code

Usage: npx @lucasnpinheiro/office [flags]
       node bin/install.mjs [flags]

  (no flag)          marketplace + agent-office only
  --with-personas    also install personas (subagent tiers + optional tier-router hook)
  --with-learning    also install learning (task-observer skill); creates ~/.claude/skill-observations/log.md
                     if missing and prints the CLAUDE.md snippet (never edits CLAUDE.md)
  --with-laya        also install laya (MCP wiring + skill); checks docker and prints the Laya setup steps
  --with-caveman     print where to get the optional caveman skill (nothing is copied)
  --all              personas + learning + laya (caveman stays a pointer: --with-caveman)
  --scope <s>        global (user settings, default non-interactive) | local (this project, .claude/settings.json)
                     (the raw CLI values user | project | local are accepted too)
  --dry-run          print the commands, run nothing, write nothing
  --uninstall        remove all four plugins and the marketplace
  -h, --help
`

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
if (has('-h') || has('--help')) { process.stdout.write(HELP); process.exit(0) }

const dry = has('--dry-run')
const all = has('--all')
const want = {
  personas: all || has('--with-personas'),
  learning: all || has('--with-learning'),
  laya: all || has('--with-laya'),
  caveman: has('--with-caveman'),
}
const si = args.indexOf('--scope')
let scope = si >= 0 ? args[si + 1] : undefined

const say = (m = '') => process.stdout.write(m + '\n')
const fail = (m) => { process.stderr.write(`error: ${m}\n`); process.exit(1) }

function normScope(s) {
  if (s === 'global' || s === 'user') return 'user'
  if (s === 'local' || s === 'project') return 'project' // "local" = this project's .claude/settings.json
  if (s === 'local-private') return 'local'
  return null
}

async function pickScope() {
  if (scope !== undefined) {
    const n = normScope(scope)
    if (!n) fail(`invalid --scope "${scope}" (use global | local)`)
    return n
  }
  if (!process.stdin.isTTY || dry) return 'user'
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question('Install scope? [g]lobal (~/.claude/settings.json) or [l]ocal (this project) [g]: ')).trim().toLowerCase()
  rl.close()
  return a.startsWith('l') ? 'project' : 'user'
}

function run(cmd, cmdArgs, { allowFail = false } = {}) {
  say(`$ ${cmd} ${cmdArgs.join(' ')}`)
  if (dry) return true
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit' })
  if (r.status !== 0 && !allowFail) fail(`command failed (exit ${r.status}): ${cmd} ${cmdArgs.join(' ')}`)
  return r.status === 0
}

function checkClaude() {
  let out = ''
  try { out = execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim() }
  catch { if (dry) { say('(dry-run) `claude` not found in PATH; continuing'); return } fail('`claude` not found in PATH. Install Claude Code first: https://code.claude.com/docs') }
  const m = out.match(/(\d+)\.(\d+)\.(\d+)/)
  if (m) {
    const v = m.slice(1, 4).map(Number)
    const older = MIN_CLAUDE.some((n, i) => v.slice(0, i).every((x, j) => x === MIN_CLAUDE[j]) && v[i] < n)
    if (older) process.stderr.write(`warning: Claude Code ${v.join('.')} is older than ${MIN_CLAUDE.join('.')}; the Office mod may not load.\n`)
  }
  say(`Claude Code: ${out}`)
}

function setupLearning() {
  const dir = join(homedir(), '.claude', 'skill-observations')
  const log = join(dir, 'log.md')
  const tpl = join(ROOT, 'plugins', 'learning', 'templates', 'log.md')
  if (existsSync(log)) say(`kept existing ${log}`)
  else if (dry) say(`(dry-run) would create ${log} from template`)
  else { mkdirSync(dir, { recursive: true }); copyFileSync(tpl, log); say(`created ${log}`) }
  say('\nAdd this block to your CLAUDE.md (the installer never edits it):\n')
  say(readFileSync(join(ROOT, 'plugins', 'learning', 'templates', 'CLAUDE.md.snippet'), 'utf8'))
}

function setupLaya() {
  const dockerOk = spawnSync('docker', ['--version'], { stdio: 'ignore' }).status === 0
  say(dockerOk ? 'docker: found' : 'docker: NOT found (Laya runs in a container; install Docker first)')
  const home = process.env.LAYA_HOME
  say(`Laya is an external project: ${LAYA_URL}`)
  if (home && existsSync(join(home, 'docker-compose.yml'))) {
    if (dockerOk) run('docker', ['compose', '-f', join(home, 'docker-compose.yml'), 'up', '-d'], { allowFail: true })
  } else {
    say('Next steps:')
    say(`  git clone ${LAYA_URL} "$HOME/laya"`)
    say('  export LAYA_HOME="$HOME/laya"   # add to your shell profile; the laya MCP reads it')
    say('  (cd "$LAYA_HOME" && docker compose up -d)')
    say('  install uv (https://docs.astral.sh/uv/) and restart Claude Code')
  }
}

async function main() {
  if (has('--uninstall')) {
    checkClaude()
    const sc = await pickScope()
    for (const p of PLUGINS) run('claude', ['plugin', 'uninstall', `${p}@${MARKET}`, '--scope', sc], { allowFail: true })
    run('claude', ['plugin', 'marketplace', 'remove', MARKET], { allowFail: true })
    say('\nUninstalled. ~/.claude/skill-observations and ~/.claude/model-router are left in place (your data).')
    return
  }
  checkClaude()
  const sc = await pickScope()
  const source = has('--local-source') ? ROOT : REPO // development: install from this checkout
  run('claude', ['plugin', 'marketplace', 'add', source, '--scope', sc])
  const toInstall = ['agent-office', ...['personas', 'learning', 'laya'].filter((p) => want[p])]
  for (const p of toInstall) run('claude', ['plugin', 'install', `${p}@${MARKET}`, '--scope', sc])
  if (want.learning) setupLearning()
  if (want.laya) setupLaya()
  if (want.caveman) {
    say(`\ncaveman (optional terse-reply skill) is not bundled. Follow the upstream instructions: ${CAVEMAN_URL}`)
  }
  if (want.personas) say('\npersonas: the tier-router hook is now active in the chosen scope. Disable with: claude plugin disable personas@office')
  say(dry ? '\n(dry-run) nothing was executed.' : '\nDone. Restart Claude Code (or run /reload-plugins), then try /office start.')
}

main().catch((e) => fail(e.message))
