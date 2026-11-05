import { test, expect } from 'claude-code/testing'
import { maskText, maskCapped, captureIoOn, MASK, MASK_FAILED, IO_MAX } from './mask'

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
