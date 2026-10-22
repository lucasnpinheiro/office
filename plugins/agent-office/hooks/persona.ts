export type Persona = {
  key: string
  name: string
  icon: string
}

export const PERSONAS: Persona[] = [
  { key: 'po', name: 'Product Owner', icon: '🎯' },
  { key: 'sl', name: 'Squad Leader', icon: '🧭' },
  { key: 'esp', name: 'Especialista', icon: '🧠' },
  { key: 'arq', name: 'Arquiteto', icon: '📐' },
  { key: 'sr', name: 'Senior', icon: '🦉' },
  { key: 'pl', name: 'Pleno', icon: '🛠️' },
  { key: 'qa', name: 'QA', icon: '🧪' },
  { key: 'dba', name: 'DBA', icon: '🗄️' },
  { key: 'appsec', name: 'AppSec', icon: '🛡️' },
  { key: 'devops', name: 'DevOps', icon: '⚙️' },
  { key: 'sre', name: 'SRE', icon: '🚨' },
  { key: 'perf', name: 'Performance', icon: '⚡' },
  { key: 'ux', name: 'UX/UI', icon: '🎨' },
  { key: 'bi', name: 'Data/BI', icon: '📊' },
  { key: 'jr', name: 'Junior', icon: '🌱' },
  { key: 'tw', name: 'Tech Writer', icon: '✍️' },
  { key: 'est', name: 'Estagiário', icon: '🐣' },
]

export const GENERIC: Persona = {
  key: 'gen', name: 'Agente', icon: '🤖',
}

export type Parsed = {
  persona: Persona
  tier?: string
  model?: string
  effort?: string
  label: string
}

export const MODEL_DISPLAY: Record<string, { icon: string; label: string }> = {
  haiku: { icon: '🪶', label: 'Haiku' },
  sonnet: { icon: '🎼', label: 'Sonnet' },
  opus: { icon: '👑', label: 'Opus' },
}
export const EFFORT_DISPLAY: Record<string, { icon: string; label: string }> = {
  low: { icon: '🟢', label: 'baixo' },
  medium: { icon: '🟡', label: 'médio' },
  high: { icon: '🔴', label: 'alto' },
}
const TIER_OF: Record<string, string> = { haiku: 'rapido', sonnet: 'padrao', opus: 'profundo' }
const MODELS = ['haiku', 'sonnet', 'opus']
const EFFORT_WORDS: Record<string, string> = { low: 'low', baixo: 'low', medium: 'medium', medio: 'medium', 'médio': 'medium', high: 'high', alto: 'high', xhigh: 'high', max: 'high' }
const stripVs = (x: string) => x.replace(/\uFE0F/g, '')

// New: "<icon> Persona · <icon> Model · <icon> esforço: label"; old: "<icon> Persona·tier·model·effort: label"
export function parseDescription(desc: string): Parsed {
  const s = (desc || '').trim()
  const colon = s.indexOf(':')
  const head = colon > 0 ? s.slice(0, colon) : ''
  const label = colon > 0 ? s.slice(colon + 1).trim() : s
  const found = PERSONAS.find(p => stripVs(head).includes(stripVs(p.icon)))
  if (!found) return { persona: GENERIC, label: s }
  const parts = stripVs(head).replace(stripVs(found.icon), '').split('·').map(x => x.trim().toLowerCase())
  let model: string | undefined
  let effort: string | undefined
  let tier: string | undefined
  for (const part of parts) {
    const words = part.split(/\s+/)
    for (const w of words) {
      if (MODELS.some(m => w.includes(m))) model = MODELS.find(m => w.includes(m))
      else if (EFFORT_WORDS[w]) effort = EFFORT_WORDS[w]
      else if (Object.values(TIER_OF).includes(w)) tier = w
    }
  }
  if (!tier && model) tier = TIER_OF[model]
  if (!model && tier) model = MODELS.find(m => TIER_OF[m] === tier)
  return { persona: found, tier, model, effort, label }
}

export const modelLabel = (m?: string): string => {
  const s = (m ?? '').toLowerCase()
  return s.includes('haiku') ? 'Haiku' : s.includes('opus') ? 'Opus' : s.includes('sonnet') || s === '' ? 'Sonnet' : m!
}

export const effortLabel = (e?: string): string => {
  const d = EFFORT_DISPLAY[EFFORT_WORDS[(e ?? 'low').toLowerCase()] ?? 'low']!
  return `${d.icon} ${d.label}`
}
export const modelDisplay = (m?: string): string => {
  const k = modelLabel(m).toLowerCase()
  const d = MODEL_DISPLAY[k]
  return d ? `${d.icon} ${d.label}` : modelLabel(m)
}
