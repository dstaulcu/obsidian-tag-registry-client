import { DEFAULT_DEST_FOLDER } from './brand'
import type { ManifestTeam } from './core/manifest'
import type { AuthMethod } from './core/sources'

export const SCHEMA_VERSION = 1

export type StartupMode = 'off' | 'notify' | 'auto'

export interface SourceSetting {
  /** Stable id; keys the token in secret storage. */
  id: string
  repoUrl: string
  /** Branch or tag. */
  ref: string
  authMethod: AuthMethod
  /** Only used when Obsidian's secret storage is unavailable; plain text in data.json. */
  token: string
}

export interface RegistrySettings {
  schemaVersion: 1
  /** Registries to merge; order is precedence. */
  sources: SourceSetting[]
  /** Selected team ids; the core is always included. */
  teams: string[]
  allTeams: boolean
  /** Ticking a team also selects its ancestors, and they are imported with it. */
  includeAncestors: boolean
  /** Show and (with all teams) import placeholder `example` teams. */
  showExampleTeams: boolean
  /** Teams seen in the last fetched manifest, so the picker works before the next fetch. */
  knownTeams: ManifestTeam[]
  destFolder: string
  startupMode: StartupMode
}

const METHODS: string[] = ['https', 'git', 'token']
const MODES: string[] = ['off', 'notify', 'auto']

export function newSource(): SourceSetting {
  return { id: `src-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, repoUrl: '', ref: 'main', authMethod: 'https', token: '' }
}

export function defaultSettings(): RegistrySettings {
  return { schemaVersion: 1, sources: [newSource()], teams: [], allTeams: false, includeAncestors: true, showExampleTeams: false, knownTeams: [], destFolder: DEFAULT_DEST_FOLDER, startupMode: 'notify' }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)

function normalizeSource(raw: unknown): SourceSetting | null {
  if (!isObj(raw)) return null
  const d = newSource()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : d.id,
    repoUrl: text(raw.repoUrl, ''),
    ref: text(raw.ref, 'main').trim() || 'main',
    authMethod: METHODS.includes(raw.authMethod as string) ? (raw.authMethod as AuthMethod) : 'https',
    token: text(raw.token, ''),
  }
}

function normalizeTeams(raw: unknown): ManifestTeam[] {
  if (!Array.isArray(raw)) return []
  const out: ManifestTeam[] = []
  for (const t of raw) if (isObj(t) && typeof t.id === 'string' && t.id) out.push({ id: t.id, name: text(t.name, t.id), description: text(t.description, ''), level: text(t.level, ''), parent: typeof t.parent === 'string' && t.parent ? t.parent : null, example: t.example === true })
  return out
}

/** Total: validates every field on its own and always returns usable settings. Unknown keys are dropped. */
export function normalizeSettings(raw: unknown): RegistrySettings {
  const d = defaultSettings()
  if (!isObj(raw)) return d
  const sources = Array.isArray(raw.sources) ? raw.sources.map(normalizeSource).filter((s): s is SourceSetting => !!s) : []
  // ids key secrets, so they must be unique
  const seen = new Set<string>()
  for (const s of sources) {
    while (seen.has(s.id)) s.id = newSource().id
    seen.add(s.id)
  }
  return {
    schemaVersion: 1,
    sources: sources.length ? sources : d.sources,
    teams: Array.isArray(raw.teams) ? raw.teams.filter((t): t is string => typeof t === 'string') : [],
    allTeams: raw.allTeams === true,
    includeAncestors: raw.includeAncestors !== false,
    showExampleTeams: raw.showExampleTeams === true,
    knownTeams: normalizeTeams(raw.knownTeams),
    destFolder: typeof raw.destFolder === 'string' ? raw.destFolder : d.destFolder,
    startupMode: MODES.includes(raw.startupMode as string) ? (raw.startupMode as StartupMode) : d.startupMode,
  }
}
