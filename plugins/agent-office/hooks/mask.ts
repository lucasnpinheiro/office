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
// wrapped token: the next line starts with a 4+ char token run (optional backslash continuation); CONT consumes the rest
const WRAP = String.raw`(?=\\?\r?\n[ \t]*[A-Za-z0-9_-]{4,})`
// AKIA keys are uppercase: a 1-3 char tail line still continues the key (main masks it)
const WRAP_UPPER = String.raw`(?=\\?\r?\n[ \t]*[0-9A-Z])`
const CONT = String.raw`(?:\\?\r?\n[ \t]*[A-Za-z0-9_-]{4,})*`

// Order matters: Bearer first so "Authorization:\n Bearer\n <token>" is fully covered by the Authorization rule.
const RULES: [RegExp, string][] = [
  // private key blocks, also when the END line is missing (cut-off text)
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g, MASK],
  [/Bearer\s+[^\s"',;}\\]+/gi, `Bearer ${MASK}`], // no \b: a glued "xBearer tok" still masks the token
  // Authorization header or JSON key: the rest of the value
  [new RegExp(`(${QUOTE}authorization${QUOTE}\\s*[:=]\\s*)(?:\\\\"[^"\\\\]*\\\\"|"(?:[^"\\\\]|\\\\.)*"|'[^']*'|[^\\r\\n"',;}]+)`, flags), `$1${MASK}`],
  // key words with ":" (value = rest of the line) or "=" (one word); quoted, array and object values whole
  [new RegExp(`(?<![\\w.-])(${QUOTE}${KEYRUN}${QUOTE}\\s*:\\s*)(?:${QUOTED}|${LINE_VALUE})`, flags), `$1${MASK}`],
  [new RegExp(`(?<![\\w.-])(${QUOTE}${KEYRUN}${QUOTE}\\s*=\\s*)(?:${QUOTED}|${BARE_VALUE})`, flags), `$1${MASK}`],
  // "api key: x", "access key = x"
  [new RegExp(`((?:api|access|private|secret|auth) key[ \\t]*[:=][ \\t]*)(?:${QUOTED}|${LINE_VALUE})`, flags), `$1${MASK}`],
  // CLI: --password x / --token x (separate word), mysql -phunter2, curl -u user:pass
  [/(?<![\w-])(--[\w-]*(?:password|passwd|token|secret|senha|credential|api-?key)[\w-]*[ \t]+)(?!-)(?:"[^"]*"|'[^']*'|\S+)/gi, `$1${MASK}`],
  // 0.28.45: options scan capped at 64 tokens so each "mysql" start is O(window); unbounded was quadratic (2.7 s at 100 KB).
  // A quoted string (-e "SELECT ...") counts as one token; the name suffix is capped at 16 chars.
  // shortcut: more than 64 plain unquoted tokens between "mysql" and -p are not masked, raise the cap if real command lines need more
  // Unambiguous: a token is a plain run ([^\s"']+) or a run of units (one plain char, a quoted string, or an unclosed
  // quote) that holds a quote. Each quote has one parse, so backtracking is linear.
  // shortcut: a token has at most 32 units, a quoted string over 2000 chars is split on its spaces, an unclosed quote
  // is one word so the words after it count toward the 64-token cap; -p after those limits is not masked, raise them if needed.
  [/((?:mysql|mariadb|mysqldump|mysqladmin)\w{0,16}(?:[ \t]+(?!-p)(?:(?=[^\s"']*["'])(?:[^\s"']|"[^"\n]{0,2000}"|'[^'\n]{0,2000}'|"(?![^"\n]{0,2000}")|'(?![^'\n]{0,2000}')){1,32}|[^\s"']+)){0,64}[ \t]+)-p(?=\S)\S+/g, `$1-p${MASK}`],
  [/(?<![\w-])((?:-u|--user|--proxy-user)(?:[ \t]+|=)["']?)[^\s"':]*:[^\s"']*/g, `$1${MASK}`],
  // known prefixes, matched wherever they sit (glued to letters, "_" or digits): "deploy_ghp_...", "tokenghp_...",
  // "deploysk-..." all leak otherwise. Body floors are the real token length or one no common word reaches
  // (sk- 20: "risk-assessment" body is 10): sk- 20, sk_/rk_ live|test 16, gh[pousr]_ 30 (spec example body is 34),
  // xox 10, AKIA exactly 16 ("AKIAN" stays clear), AIza 16, npm_ 30, eyJ header 10-300 + 2 dots (bounded: repeated eyJ stays linear). A long token wrapped onto the
  // next line (optionally after a backslash) is one token.
  // Every floored prefix also takes a first chunk of 8+ chars when a wrapped line continues it (WRAP), so a real token
  // cut at any column is one token, as on main. Bare "sk-" (and sk-ant-) needs a digit or uppercase letter in its first
  // 20 body chars: real keys are mixed case, kebab slugs ("risk-assessment-...") are not.
  [new RegExp(`(?:sk-(?:(?=[A-Za-z0-9_-]{0,19}[0-9A-Z])[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{8,200}${WRAP})|[sr]k_(?:live|test)_(?:[A-Za-z0-9]{16,}|[A-Za-z0-9]{8,200}${WRAP})|gh[pousr]_(?:[A-Za-z0-9]{30,}|[A-Za-z0-9]{8,200}${WRAP})|xox[A-Za-z]-(?:[\\w-]{10,}|[\\w-]{8,200}${WRAP})|AKIA(?:[0-9A-Z]{16,}|[0-9A-Z]{8,200}${WRAP_UPPER})|AIza(?:[\\w-]{16,}|[\\w-]{8,200}${WRAP})|npm_(?:[A-Za-z0-9]{30,}|[A-Za-z0-9]{8,200}${WRAP})|eyJ[\\w-]{10,300}\\.[\\w-]+\\.[\\w-]*)${CONT}`, 'g'), MASK],
  // GitHub fine-grained PAT: case-insensitive ("xGITHUB_PAT_..."), body floor 40 or 8 + wrapped line
  [new RegExp(`github_pat_(?:\\w{40,}|\\w{8,200}${WRAP})${CONT}`, 'gi'), MASK],
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
