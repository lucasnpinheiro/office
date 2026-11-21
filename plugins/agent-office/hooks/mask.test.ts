import { test, expect } from 'claude-code/testing'
import { maskText, maskCapped, captureIoOn, MASK, MASK_FAILED, IO_MAX, IN_MAX } from './mask'

// Realistic shapes only (fake values built at runtime so no secret scanner trips on this file)
const GH = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const SK = 'sk-' + 'proj-Ab12Cd34Ef56Gh78Ij90Kl12Mn34'
const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE'
const SLACK = 'xoxb-' + '123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'
const PAT = 'github_pat_' + '11ABCDEFG0abcdefghijkl_mnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV'
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'

// AC-010 / U-007 / SEC-001: one case per minimal pattern (spec/04-contracts.md)
const cases: [string, string, string][] = [
  ['Authorization header', 'curl -H "Authorization: Basic dXNlcjpwYXNz" https://x.test', 'dXNlcjpwYXNz'],
  ['Bearer', `Authorization: Bearer ${JWT}`, JWT],
  ['Bearer solto', `usa Bearer ${JWT} no header`, JWT],
  ['token=', `export GITHUB_TOKEN=${GH}`, GH],
  ['secret:', 'client_secret: s3cr3tValue-123', 's3cr3tValue-123'],
  ['password=', 'mysql --password=hunter2hunter2 -u root', 'hunter2hunter2'],
  ['passwd', 'passwd = "p@ss w0rd longa"', 'p@ss w0rd longa'],
  ['api_key', 'api_key=abcd1234efgh5678', 'abcd1234efgh5678'],
  ['apikey', 'apikey: abcd1234efgh5678', 'abcd1234efgh5678'],
  ['sk-', `OPENAI=${SK}`, SK],
  ['ghp_', `git clone https://x/${GH}`, GH],
  ['gho_', 'tok gho_' + 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp', 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp'],
  ['github_pat_', `PAT ${PAT}`, PAT],
  ['xox', `slack ${SLACK}`, SLACK],
  ['AKIA', `aws ${AWS}`, AWS],
  ['URL user:pass@', 'git clone https://deploy:Sup3rS3cret!@git.example.com/r.git', 'Sup3rS3cret!'],
]
for (const [name, input, secret] of cases) {
  test(`AC-010: mascara ${name}`, () => {
    const out = maskText(input)
    expect(out).not.toContain(secret)
    expect(out).toContain(MASK)
  })
}

test('AC-010: texto sem segredo passa intacto', () => {
  const t = 'git status e depois ler Foo.php (token count 5)'
  expect(maskText(t)).toBe(t)
})

test('AC-010: bloco de chave privada (várias linhas, e sem fechamento)', () => {
  const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\nVJTUt9Us8cKjMzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictG'
  const pem = `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----`
  const out = maskText(`antes\n${pem}\ndepois`)
  expect(out).not.toContain('MIIEvQ')
  expect(out).not.toContain('VJTUt9')
  expect(out).toContain('antes')
  expect(out).toContain('depois')
  const open = maskText(`-----BEGIN PRIVATE KEY-----\n${body}`)
  expect(open).not.toContain('VJTUt9')
})

test('AC-010: valores em JSON, também JSON dentro de string', () => {
  const j = JSON.stringify({ user: 'ana', password: 'p4ss w0rd', nested: { api_key: 'abcd1234efgh', Authorization: `Bearer ${JWT}` }, ok: 1 })
  const out = maskText(j)
  for (const s of ['p4ss w0rd', 'abcd1234efgh', JWT]) expect(out).not.toContain(s)
  expect(out).toContain('"user":"ana"')
  const inner = maskText(JSON.stringify({ command: j }))
  for (const s of ['p4ss w0rd', 'abcd1234efgh', JWT]) expect(inner).not.toContain(s)
  expect(maskText('{"access_token": "ya29.A0ARrdaM-abc_DEF", "x": 1}')).not.toContain('ya29.A0ARrdaM')
})

test('AC-010: segredo quebrado em linhas', () => {
  expect(maskText(`token=\n${GH}`)).not.toContain(GH)
  expect(maskText(`Authorization:\n  Bearer\n  ${JWT}`)).not.toContain(JWT)
  expect(maskText('password:\n  "abc def ghi 123"')).not.toContain('abc def ghi 123')
  // long token wrapped in two lines (terminal wrap / backslash continuation)
  const half = Math.floor(GH.length / 2)
  const a = GH.slice(0, half), b = GH.slice(half)
  for (const sep of ['\n', '\\\n', '\r\n']) {
    const out = maskText(`x ${a}${sep}${b} y`)
    expect(out).not.toContain(b)
    expect(out).not.toContain(a)
  }
})

test('AC-010: idempotente e sem eco do valor', () => {
  const once = maskText(`password=${'x'.repeat(12)} e ${GH}`)
  expect(maskText(once)).toBe(once)
})

// AC-012 / U-008 / SEC-002: fail closed
test('AC-012: exceção no mascaramento devolve só o marcador', () => {
  const out = maskText(`token=${GH}`, () => { throw new Error('boom') })
  expect(out).toBe(MASK_FAILED)
  expect(MASK_FAILED).toBe('[mascaramento falhou]')
  expect(out).not.toContain(GH)
})

test('AC-012: entrada que não é texto falha fechada', () => {
  expect(maskText(undefined as unknown as string)).toBe(MASK_FAILED)
  expect(maskText({ toString() { throw new Error('x') } } as unknown as string)).toBe(MASK_FAILED)
})

test('AC-012: maskCapped também falha fechado', () => {
  expect(maskCapped(`token=${GH}`, () => { throw new Error('boom') })).toBe(MASK_FAILED)
})

// AC-013 / U-009: mask before truncating
test('AC-013: mascara antes de truncar; segredo no limite não vaza parte', () => {
  const pad = 'a '.repeat((IO_MAX - 20) / 2)
  const out = maskCapped(`${pad}token=${GH}`)
  expect(out.length).toBeLessThanOrEqual(IO_MAX)
  expect(out).not.toContain('ghp_a1B2')
  expect(maskCapped('x'.repeat(IO_MAX * 3)).length).toBe(IO_MAX)
})

// V-001 / V-002
test('AC-011: só o valor exato 1 liga a captura', () => {
  expect(captureIoOn('1')).toBe(true)
  for (const v of ['0', 'true', ' 1', '1 ', '', undefined, 'yes', '11']) expect(captureIoOn(v)).toBe(false)
})

// Judge finding 1: ReDoS. Linear matching + input cap (bounded input, no timing assertion)
test('SEC: entrada adversarial grande é limitada e continua mascarada', () => {
  const big = '-token'.repeat(30000) + ` password=${GH}`
  const out = maskText(big)
  expect(out.length).toBeLessThanOrEqual(IN_MAX + 64)
  expect(out).not.toContain(GH)
  const tail = 'x'.repeat(IN_MAX) + ` token=${GH}`
  expect(maskText(tail)).not.toContain(GH)
  // key-like runs, quotes without a close, many keys: still bounded by the cap
  for (const t of ['-token'.repeat(30000), 'a.'.repeat(60000), 'password="'.repeat(20000), 'x token '.repeat(20000), '://a:'.repeat(30000)])
    expect(maskText(t).length).toBeLessThanOrEqual(IN_MAX + 64)
})

test('SEC: tempo limitado em entrada adversarial no teto (folga larga)', () => {
  const t0 = Date.now()
  maskText('-token'.repeat(30000))
  expect(Date.now() - t0).toBeLessThan(2000)
})

// Judge finding 2: whole value masked
test('SEC: valor inteiro mascarado (array, espaços, @ na senha)', () => {
  const j = maskText('{"password":["abc1","def2"],"ok":1}')
  expect(j).not.toContain('abc1'); expect(j).not.toContain('def2'); expect(j).toContain('"ok":1')
  expect(maskText('{"password":[["abc1"],["def2"]]}')).not.toMatch(/abc1|def2/)
  expect(maskText('{"token":{"a":"zz9","b":"yy8"},"ok":1}')).not.toMatch(/zz9|yy8/)
  const sp = maskText('password: hunter two')
  expect(sp).not.toContain('hunter'); expect(sp).not.toContain('two')
  const u = maskText('git clone https://user:p@ss:word@host/r.git')
  expect(u).not.toContain('p@ss'); expect(u).not.toContain('word'); expect(u).toContain('@host/r.git')
})

// Judge finding 3: more patterns
const more: [string, string, string][] = [
  ['credential=', 'credential=abc123secretvalue', 'abc123secretvalue'],
  ['PRIVATE_KEY=', 'PRIVATE_KEY=zzTopSecret99', 'zzTopSecret99'],
  ['ACCESS_KEY=', 'ACCESS_KEY=qqAccess8877', 'qqAccess8877'],
  ['api key:', 'api key: abc999zzz', 'abc999zzz'],
  ['curl -u', 'curl -u admin:s3cretpw https://x.test', 's3cretpw'],
  ['--password x', 'tool --password hunter22 --other', 'hunter22'],
  ['-phunter2', 'mysql -u root -phunter2 db', 'hunter2'],
  ['sk_live_', 'k=' + 'sk_live_' + 'AbCdEfGh12345678', 'AbCdEfGh12345678'],
  ['slack hook', 'https://hooks.slack.com/services/' + 'T0000AAAA/B0000BBBB/XXXXxxxxYYYYyyyy', 'XXXXxxxxYYYYyyyy'],
  ['AIza', 'k ' + 'AIza' + 'SyA-1234567890abcdefghijk', 'SyA-1234567890abcdefghijk'],
  ['npm_', 'npm_' + 'abcdefghij0123456789ABCDEFGHIJ', 'abcdefghij0123456789'],
  ['redis ://:pw@', 'redis://:pw0rd@cache:6379', 'pw0rd'],
  ['?key=', 'GET https://api.test/v1?key=abcd1234zz&x=1', 'abcd1234zz'],
  ['senha=', 'senha=minhaSenha77', 'minhaSenha77'],
]
for (const [name, input, secret] of more) {
  test(`SEC: mascara ${name}`, () => {
    const out = maskText(input)
    expect(out).not.toContain(secret)
    expect(out).toContain(MASK)
  })
}

test('SEC: sem exagero em comandos comuns', () => {
  for (const t of ['git push -u origin main', 'ls -path foo', 'npm run build --silent', 'curl -u onlyuser https://x.test', 'mysql -u root db', 'see https://example.com:8080/a/b@2x.png']) expect(maskText(t)).toBe(t)
})

// 0.28.44: secrets glued to letters, "_" or digits before the known prefix are masked (no lookbehind on prefixes)
const GHB = 'A1b2C3d4E5f6g7h8I9j0K1l2M3n4O5p6Q7'
const SKB = 'A1b2C3d4E5f6g7h8I9j0K1l2M3n4'
const PATB = '11ABCDEFG0abcdefghijkl_mnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV'
const glued: [string, string][] = [
  ['deploy_ghp_', 'deploy_ghp_' + GHB],
  ['tokenghp_', 'tokenghp_' + GHB],
  ['deploysk- (glued to letters)', 'deploysk-' + SKB],
  ['CI_sk- (glued to "_")', 'CI_sk-proj-Ab12Cd34Ef56Gh78Ij90Kl12Mn34'],
  ['xGITHUB_PAT_ (case-insensitive)', 'xGITHUB_PAT_' + PATB],
  ['github_pat_ glued', 'x9github_pat_' + PATB],
  ['xoxb- glued', 'myxoxb-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'],
  ['AKIA glued', 'myAKIAIOSFODNN7EXAMPLE'],
  ['AIza glued', 'myAIzaSyA-1234567890abcdefghijk'],
  ['npm_ glued', 'mynpm_abcdefghij0123456789ABCDEFGHIJ'],
  ['eyJ JWT glued', 'myeyJzdWIiOiIxMjM0NTY3ODkwIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r'],
  ['sk_live_ glued', 'shsk_live_AbCdEfGh12345678'],
  ['Bearer glued', 'xBearer abcDEF123ghiJKL456mnoPQR'],
  ['authorization glued', 'xauthorization: Basic dXNlcjpwYXNz'],
  ['api key glued', 'myapi key: abc999zzz'],
  ['mysql -p glued', 'xmysql -phunter2 db'],
]
for (const [name, input] of glued) {
  test(`0.28.44 RED: mascara glued ${name}`, () => {
    const out = maskText(input)
    expect(out).toContain(MASK)
    for (const s of [GHB, SKB, PATB, 'hbGciOi', '123456789012', 'IOSFODNN7EXAMPLE', 'SyA-1234567890', 'abcdefghij0123456789', 'Ab12Cd34', 'AbCdEfGh12345678', 'abcDEF123ghiJKL', 'dXNlcjpwYXNz', 'abc999zzz', 'hunter2', 'eyJzdWIi', 'AbCdEfGhIjKl'])
      if (input.includes(s)) expect(out).not.toContain(s)
  })
}

// false positives: common words and ids stay clear (real tokens have long bodies, see the rule table in the PR)
const clear = ['risk-assessment', 'task-runner', 'disk-usage', 'ask-me-later', 'desk-check', 'mask-views', 'skeleton',
  'bask_in_light', 'ghost_protocol', 'npm_install_all', 'AKIAN', 'eyJ short', 'eyJx.y', 'sk-learn.py', 'sk_learn',
  'gho_', 'Dev: revisar migração', 'T-401 agora']
for (const t of clear) test(`0.28.44 FP: "${t}" passa intacto`, () => {
  expect(maskText(t)).toBe(t)
})

// 0.28.44 review: a real-length token wrapped at 80 cols (newline, optional backslash) is masked for every prefix,
// at every cut position. No 6-char window of the token may survive (same harness idea as the reviewer's h.mjs).
const WRAP_TOKENS: [string, string][] = [
  ['sk-', 'sk-' + 'Ep18zhnK7nw5rrblP3oh5LkEqcMY8n7d9OB8NRZ3MkoCKTKI'],
  ['sk-ant-', 'sk-ant-api03-' + '8dUqLmN2pQrS5tUvW3xYz7AbCdEfGh9JkLmNpQrStUvWxYzAbCdEf'],
  ['github_pat_', 'github_pat_' + 'PnmjgrhDKDREIvlCn3w1ij0QrStUvWxYz5AbCdEfGhIjKlMnOpQrStUvWxYz'],
  ['npm_', 'npm_' + 'Y1beuN5RLmskmvbJn4rLwkjxQ6CYdAbCdEfGhIj'],
  ['AKIA', 'AKIAKJZE7DJLN7L2KQYSXYZ'],
  ['sk_live_', 'sk_live_' + 'UrqDz5gyZuKNVBekwQgfTPLH'],
  ['ghp_', 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
  ['xoxb-', 'xoxb-' + '123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'],
  ['AIza', 'AIza' + 'SyA-1234567890abcdefghijkLmNoPqRs'],
]
for (const [name, tok] of WRAP_TOKENS) test(`0.28.44 wrap: ${name} wrapped at every cut is masked, no 6-char window survives`, () => {
  // cuts before prefix + 8 body chars leave a first line too short for main to mask either: not a regression, skipped
  for (let cut = name.length + 8; cut < tok.length - 4; cut++) {
    for (const sep of ['\\\n', '\n']) {
      const input = `x="${tok.slice(0, cut)}${sep}  ${tok.slice(cut)}" y`
      const out = maskText(input)
      for (let i = 0; i + 6 <= tok.length; i++) {
        const w = tok.slice(i, i + 6)
        if (out.includes(w)) throw new Error(`leak ${name} cut=${cut} sep=${JSON.stringify(sep)} window=${w} out=${JSON.stringify(out)}`)
      }
    }
  }
})

// bare sk- needs a digit or uppercase letter in the first 20 body chars; kebab slugs stay clear
const SLUGS = ['task-runner-for-nightly-builds', 'risk-assessment-for-payments-module', 'disk-usage-report-weekly-2026',
  'ask-before-deploying-to-production', 'risk-management-dashboard-v2', 'frisk-the-whole-codebase-now',
  'docs/task-runner-for-nightly-builds/README.md', 'src/risk-assessment-for-payments-module/index.ts',
  'reports/disk-usage-report-weekly-2026.csv', 'ask-before-deploying-to-production/steps.md']
for (const t of SLUGS) test(`0.28.44 FP slug: "${t}" passa intacto`, () => {
  expect(maskText(t)).toBe(t)
})
test('0.28.44: deploy_sk-A1b2C3d4E5f6g7h8I9j0K1l2 still masked', () => {
  const s = 'deploy_sk-A1b2C3d4E5f6g7h8I9j0K1l2'
  expect(maskText(s)).not.toContain('A1b2C3d4E5f6g7h8I9j0K1l2')
})

// 0.28.44 review (blocking 1): the eyJ rule must not be quadratic on repeated "eyJ" starts (main: ~5 ms)
const timeMask = (s: string): number => {
  const t0 = performance.now()
  maskText(s)
  return performance.now() - t0
}
const PERF_MS = 200 // generous: flakes avoided, the quadratic input took 8 s
for (const [name, s] of [
  ['eyJ x33000', 'eyJ'.repeat(33000)],
  ['(eyJ+aaaaaaa) x10000', ('eyJ' + 'a'.repeat(7)).repeat(10000)],
  ['eyJ + 99k a', 'eyJ' + 'a'.repeat(99990)],
] as [string, string][]) test(`0.28.44 perf: ${name} masks in < ${PERF_MS} ms`, () => {
  const ms = timeMask(s)
  if (ms >= PERF_MS) throw new Error(`${name} took ${Math.round(ms)} ms`)
})
for (const p of ['sk-', 'sk_live_', 'ghp_', 'github_pat_', 'AKIA', 'AIza', 'npm_', 'xoxb-', 'eyJ']) test(`0.28.44 perf: ${p} repeated to 100 KB masks in < ${PERF_MS} ms`, () => {
  const s = p.repeat(Math.ceil(100_000 / p.length))
  const ms = timeMask(s)
  if (ms >= PERF_MS) throw new Error(`${p} x100K took ${Math.round(ms)} ms`)
})

// 0.28.45: the mysql -p rule was quadratic (each "mysql" start scanned to the end: ~2.7 s at 100 KB on 0.28.44)
for (const [name, s] of [
  ['mysql a b c x8500', 'mysql a b c '.repeat(8500)],
  ['mysql -u root -p x', 'mysql -u root -p'.repeat(6000)],
  ['mysql a x50000', 'mysql ' + 'a '.repeat(50000)],
  ['mysql -h x -P 3306 x', 'mysql -h x -P 3306 '.repeat(6000)],
] as [string, string][]) test(`0.28.45 perf: mysql -p rule ${name} masks in < ${PERF_MS} ms`, () => {
  const ms = timeMask(s)
  if (ms >= PERF_MS) throw new Error(`${name} took ${Math.round(ms)} ms`)
})

// deterministic pseudo-random base64url run (no periodic windows that could hide a leak)
const runOf = (n: number, seed: number): string => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let x = seed
  let out = ''
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    out += A[x % A.length]
  }
  return out
}
// 0.28.44 review: a real JWT of 600 chars (header 100, payload 300, signature 190) is still fully masked
test('0.28.44 cap: 600-char JWT fully masked, no 6-char window survives', () => {
  const jwt = 'eyJ' + runOf(97, 1) + '.' + runOf(300, 2) + '.' + runOf(190, 3)
  const out = maskText(`token=${jwt} end`)
  for (let i = 0; i + 6 <= jwt.length; i++) {
    const w = jwt.slice(i, i + 6)
    if (out.includes(w)) throw new Error(`leak window=${w} out=${out.slice(0, 80)}`)
  }
})

// 0.28.44 review (blocking 2): AKIA cut so the continuation holds 1-3 chars is masked, as on main
for (const [name, s] of [
  ['13 body + 3 tail', 'AKIAABCDEFGHJKLMN\nR5P'],
  ['13 body + 3 tail, 4-space indent', 'AKIAABCDEFGHJKLMN\n    R5P'],
  ['15 body + 1 tail', 'AKIAABCDEFGHJKLMNPQ\nR'],
  ['13 body + 3 tail, backslash-newline', 'AKIAABCDEFGHJKLMN\\\nR5P'],
  ['13 body + 3 tail, CRLF', 'AKIAABCDEFGHJKLMN\r\nR5P'],
] as [string, string][]) test(`0.28.44 AKIA wrap: ${name} first chunk masked`, () => {
  const out = maskText(s)
  if (out.includes('ABCDEFGH')) throw new Error(`leak out=${JSON.stringify(out)}`)
})

// 0.28.44 review: every prefix keeps a 1-3 char tail masked (main masks these), not only AKIA
for (const [name, tok] of [...WRAP_TOKENS, ['AKIA', 'AKIAABCDEFGHJKLMNPQR']] as [string, string][]) test(`0.28.44 wrap: ${name} with a 1-3 char tail line is masked`, () => {
  for (let cut = Math.max(name.length + 8, tok.length - 3); cut < tok.length; cut++) {
    const input = `x="${tok.slice(0, cut)}\n${tok.slice(cut)}" y`
    const out = maskText(input)
    for (let i = 0; i + 6 <= tok.length; i++) {
      const w = tok.slice(i, i + 6)
      if (out.includes(w)) throw new Error(`leak ${name} cut=${cut} window=${w} out=${JSON.stringify(out)}`)
    }
  }
})
