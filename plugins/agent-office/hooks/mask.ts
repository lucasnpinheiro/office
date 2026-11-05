// Secret masking (T-004). Pure: no engine APIs, no disk, no network. Everything that reaches the in-memory state
// (prompt, labels, optional tool input/output) goes through maskText first. Fail closed: if masking cannot run,
// the original text is dropped and MASK_FAILED is stored instead.

export const MASK = '••••••••'
export const MASK_FAILED = '[mascaramento falhou]'
export const IO_MAX = 2000 // characters per io field, applied AFTER masking

// Only the exact value "1" turns tool input/output capture on (OFFICE_CAPTURE_IO).
export const captureIoOn = (v: string | undefined): boolean => v === '1'

const KEY = '[\\w.-]*(?:token|secret|password|passwd|api[_-]?key|apikey)[\\w.-]*'
const QUOTE = '\\\\?["\']?' // quote, optionally backslash-escaped (JSON inside a JSON string)
const VALUE = [
  '\\\\"[^"\\\\]*\\\\"', // \"value\" (escaped JSON)
  '"(?:[^"\\\\]|\\\\.)*"', // "value", may span lines
  "'[^']*'",
  '[^\\s"\',;&}\\\\]+', // bare value
].join('|')

// Order matters: Bearer first so "Authorization:\n Bearer\n <token>" is fully covered by the Authorization rule.
const RULES: [RegExp, string][] = [
  // private key blocks, also when the END line is missing (cut-off text)
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g, MASK],
  [/\bBearer\s+[^\s"',;}\\]+/gi, `Bearer ${MASK}`],
  // Authorization header or JSON key: the rest of the value
  [new RegExp(`(?<![\\w-])(${QUOTE}authorization${QUOTE}\\s*[:=]\\s*)(?:\\\\"[^"\\\\]*\\\\"|"(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^\\r\\n"',;}]+)`, 'gi'), `$1${MASK}`],
  // token / secret / password / passwd / api_key / apikey pairs with = or :, JSON and key: "value" included
  [new RegExp(`(?<![\\w.-])(${QUOTE}${KEY}${QUOTE}\\s*[:=]\\s*)(?:${VALUE})`, 'gi'), `$1${MASK}`],
  // known prefixes; a long token wrapped onto the next line (optionally after a backslash) is one token
  [/(?<![A-Za-z0-9_])(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_\w{8,}|xox[A-Za-z]-[\w-]{8,}|AKIA[0-9A-Z]{8,}|eyJ[\w-]{8,}\.[\w-]+\.[\w-]*)(?:\\?\r?\n[ \t]*[A-Za-z0-9_-]{4,})*/g, MASK],
  // password in URL: ://user:pass@host
  [/(:\/\/[^\s:/@]+:)[^\s@]+(?=@)/g, `$1${MASK}`],
]

const apply = (text: string): string => RULES.reduce((t, [re, to]) => t.replace(re, to), text)

// Masks every recognised secret. `impl` exists so tests can force a failure; any throw or non-text input
// returns MASK_FAILED and never the original.
export function maskText(text: string, impl: (t: string) => string = apply): string {
  try {
    if (typeof text !== 'string') return MASK_FAILED
    const out = impl(text)
    return typeof out === 'string' ? out : MASK_FAILED
  } catch {
    return MASK_FAILED
  }
}

// Masks first, then cuts to IO_MAX, so a secret on the boundary never leaks a part of itself.
export function maskCapped(text: string, impl?: (t: string) => string): string {
  const m = maskText(text, impl)
  return m === MASK_FAILED ? m : m.slice(0, IO_MAX)
}
