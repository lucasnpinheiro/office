// Secret masking (T-004). Pure: no engine APIs, no disk, no network. Everything that reaches the in-memory state
// (prompt, labels, optional tool input/output) goes through maskText first. Fail closed: if masking cannot run,
// the original text is dropped and MASK_FAILED is stored instead.

export const MASK = '••••••••'
export const MASK_FAILED = '[mascaramento falhou]'
export const IO_MAX = 2000 // characters per io field, applied AFTER masking

// Only the exact value "1" turns tool input/output capture on (OFFICE_CAPTURE_IO).
export const captureIoOn = (v: string | undefined): boolean => v === '1'

// Input cap: text longer than this is cut BEFORE masking (what is dropped is never stored, so nothing leaks) and the
// patterns below are written to be linear, so masking time stays bounded (ReDoS, judge finding).
export const IN_MAX = 100_000

// Key words. The key is matched as one run of [\w.-] with a lookahead that only scans that run (linear): the old
// `[\w.-]*word[\w.-]*` backtracked quadratically on '-token'.repeat(n).
const KW = '(?:token|secret|password|passwd|senha|credential|api[_-]?key|apikey|private[_-]?key|access[_-]?key)'
const QUOTE = '\\\\?["\']?' // quote, optionally backslash-escaped (JSON inside a JSON string)
const KEYRUN = `(?=[\\w.-]*${KW})[\\w.-]+`
const BARE_VALUE = '[^\\s"\',;&}\\\\]+' // one word
const LINE_VALUE = '[^\\r\\n"\',;&}\\\\]+' // after ":" the rest of the line, so "password: hunter two" is fully masked
const QUOTED = [
  '\\\\"[^"\\\\]*\\\\"', // \"value\" (escaped JSON)
  '"(?:[^"\\\\]|\\\\.)*"', // "value", may span lines
  "'[^']*'",
  '\\[(?:[^\\[\\]]|\\[[^\\[\\]]*\\])*(?:\\]|$)', // [..] arrays, one nesting level, unterminated runs to the end
  '\\{(?:[^{}]|\\{[^{}]*\\})*(?:\\}|$)', // {..} objects
].join('|')
const flags = 'gi'

// Order matters: Bearer first so "Authorization:\n Bearer\n <token>" is fully covered by the Authorization rule.
const RULES: [RegExp, string][] = [
  // private key blocks, also when the END line is missing (cut-off text)
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g, MASK],
  [/\bBearer\s+[^\s"',;}\\]+/gi, `Bearer ${MASK}`],
  // Authorization header or JSON key: the rest of the value
  [new RegExp(`(?<![\\w-])(${QUOTE}authorization${QUOTE}\\s*[:=]\\s*)(?:\\\\"[^"\\\\]*\\\\"|"(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^\\r\\n"',;}]+)`, flags), `$1${MASK}`],
  // key words with ":" (value = rest of the line) or "=" (one word); quoted, array and object values whole
  [new RegExp(`(?<![\\w.-])(${QUOTE}${KEYRUN}${QUOTE}\\s*:\\s*)(?:${QUOTED}|${LINE_VALUE})`, flags), `$1${MASK}`],
  [new RegExp(`(?<![\\w.-])(${QUOTE}${KEYRUN}${QUOTE}\\s*=\\s*)(?:${QUOTED}|${BARE_VALUE})`, flags), `$1${MASK}`],
  // "api key: x", "access key = x"
  [new RegExp(`(?<![\\w.-])((?:api|access|private|secret|auth) key[ \\t]*[:=][ \\t]*)(?:${QUOTED}|${LINE_VALUE})`, flags), `$1${MASK}`],
  // CLI: --password x / --token x (separate word), mysql -phunter2, curl -u user:pass
  [/(?<![\w-])(--[\w-]*(?:password|passwd|token|secret|senha|credential|api-?key)[\w-]*[ \t]+)(?!-)(?:"[^"]*"|'[^']*'|\S+)/gi, `$1${MASK}`],
  [/(\b(?:mysql|mariadb|mysqldump|mysqladmin)\w*(?:[ \t]+(?!-p)\S+)*[ \t]+)-p(?=\S)\S+/g, `$1-p${MASK}`],
  [/(?<![\w-])((?:-u|--user|--proxy-user)(?:[ \t]+|=)["']?)[^\s"':]*:[^\s"']*/g, `$1${MASK}`],
  // known prefixes; a long token wrapped onto the next line (optionally after a backslash) is one token
  [/(?<![A-Za-z0-9_])(?:sk-[A-Za-z0-9_-]{8,}|[sr]k_(?:live|test)_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|github_pat_\w{8,}|xox[A-Za-z]-[\w-]{8,}|AKIA[0-9A-Z]{8,}|AIza[\w-]{16,}|npm_[A-Za-z0-9]{16,}|eyJ[\w-]{8,}\.[\w-]+\.[\w-]*)(?:\\?\r?\n[ \t]*[A-Za-z0-9_-]{4,})*/g, MASK],
  // Slack incoming webhooks carry the secret in the path
  [/(hooks\.slack\.com\/services\/)[A-Za-z0-9/_-]+/g, `$1${MASK}`],
  // ?key=... / &key=... in URLs
  [/([?&]key=)[^&\s"'#]+/gi, `$1${MASK}`],
  // password in URL: ://user:pass@host (empty user ok; the password may hold ":" and "@": up to the LAST "@" of the word)
  [/(:\/\/[^\s:/@]*:)[^\s/]*(?=@)/g, `$1${MASK}`],
]

const apply = (text: string): string => RULES.reduce((t, [re, to]) => t.replace(re, to), text.length > IN_MAX ? text.slice(0, IN_MAX) : text)

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
