import type { RegistrySettings } from '../settings'

/** Plain scalars only: everything the report may contain is listed here, nothing else can leak in. */
export interface DiagnosticsSnapshot {
  pluginVersion: string
  obsidianVersion: string
  platform: string
  arch: string
  sourceCount: number
  /** Distinct access methods in use, e.g. `https, token`. */
  methods: string
  /** Number of selected teams, or `all`. */
  teams: string
  startupMode: string
  secretStorage: boolean
  debugLogging: boolean
}

/** Reduce settings to the allowed scalars. URLs, tokens, team names and the destination never pass through. */
export function snapshotFromSettings(
  s: RegistrySettings,
  env: { pluginVersion: string; obsidianVersion: string; platform: string; arch: string; secretStorage: boolean },
): DiagnosticsSnapshot {
  const configured = s.sources.filter((x) => x.repoUrl.trim())
  return {
    ...env,
    sourceCount: configured.length,
    methods: [...new Set(configured.map((x) => x.authMethod))].join(', ') || 'none',
    teams: s.allTeams ? 'all' : String(s.teams.length),
    startupMode: s.startupMode,
    debugLogging: s.debugLogging,
  }
}

const yn = (b: boolean) => (b ? 'yes' : 'no')

/** Markdown block for pasting into a GitHub issue. */
export function buildReport(s: DiagnosticsSnapshot): string {
  return (
    [
      '### Diagnostics',
      '',
      `- Plugin: ${s.pluginVersion}`,
      `- Obsidian: ${s.obsidianVersion}`,
      `- OS: ${s.platform} ${s.arch}`,
      `- Sources: ${s.sourceCount}`,
      `- Access methods: ${s.methods}`,
      `- Selected teams: ${s.teams}`,
      `- Startup mode: ${s.startupMode}`,
      `- Secret storage available: ${yn(s.secretStorage)}`,
      `- Debug logging: ${yn(s.debugLogging)}`,
    ].join('\n') + '\n'
  )
}
