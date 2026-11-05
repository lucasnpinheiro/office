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
