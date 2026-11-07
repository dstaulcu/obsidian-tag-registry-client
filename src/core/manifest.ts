export interface ManifestTag {
  tag: string
  facet: string
  /** `core` or a team id. */
  source: string
  status: 'active' | 'proposed' | 'deprecated'
  replaced_by: string | null
  aliases: string[]
  definition: string
  /** Repo-relative note path, e.g. `core/tool/git.md` or `teams/dave/project/x.md`. */
  path: string
  /** sha256 hex of the note exactly as stored upstream. */
  hash: string
}

export interface ManifestTeam {
  /** Folder path below `teams/`, `/`-separated (e.g. `org/component`). */
  id: string
  name: string
  description: string
  /** Free-text tier name (directorate, branch, ...). Display only. */
  level: string
  /** Parent team id, or null for a top-level team. */
  parent: string | null
  /** Placeholder team; clients hide it by default. */
  example: boolean
}

export interface Manifest {
  version: 2
  facets: string[]
  teams: ManifestTeam[]
  tags: ManifestTag[]
}

/** The file every registry publishes at its root. */
export const MANIFEST_FILE = 'registry.json'

const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** A team id: one or more kebab-case folder names joined by `/`. A top-level team may not be called `core` (it would collide with the core folder). */
export function isTeamId(id: unknown): id is string {
  return typeof id === 'string' && id.split('/').every((s) => SEGMENT.test(s)) && id.split('/')[0] !== 'core'
}

/**
 * A repo path is safe to turn into a vault path: relative, no `..`, no hidden or empty segments, every segment
 * kebab-case, and shaped `core/<facet>/<name>.md` or `teams/<team...>/<facet>/<name>.md` (teams nest to any depth).
 */
export function isSafeNotePath(p: unknown): p is string {
  if (typeof p !== 'string' || !p.endsWith('.md') || p.includes('\\') || p.startsWith('/')) return false
  const parts = p.split('/')
  if (parts.some((s) => !s || s.startsWith('.') || s === '..')) return false
  const segs = [...parts.slice(0, -1), parts[parts.length - 1].slice(0, -3)]
  if (!segs.every((s, i) => (i === 0 ? s === 'core' || s === 'teams' : SEGMENT.test(s)))) return false
  return parts[0] === 'core' ? parts.length === 3 : parts.length >= 4 && segs[1] !== 'core'
}

/** Map a repo path to the vault path under `destFolder`: `core/x` -> `<dest>/core/x`, `teams/t/x` -> `<dest>/t/x`. */
export function vaultRelPath(repoPath: string): string {
  return repoPath.startsWith('teams/') ? repoPath.slice('teams/'.length) : repoPath
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function parseManifest(text: string): Manifest {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`${MANIFEST_FILE} is not valid JSON`)
  }
  const m = raw as { version?: unknown; facets?: unknown; teams?: unknown; tags?: unknown }
  if (!m || m.version !== 2 || !Array.isArray(m.tags)) throw new Error(`${MANIFEST_FILE} has an unsupported format (expected version 2)`)
  const facets = Array.isArray(m.facets) ? m.facets.map(String) : []
  const teams: ManifestTeam[] = []
  for (const t of Array.isArray(m.teams) ? (m.teams as Partial<ManifestTeam>[]) : []) {
    if (t && isTeamId(t.id)) {
      teams.push({ id: t.id, name: str(t.name) || t.id, description: str(t.description), level: str(t.level), parent: isTeamId(t.parent) ? t.parent : null, example: t.example === true })
    }
  }
  for (const t of teams) if (t.parent && !teams.some((x) => x.id === t.parent)) t.parent = null
  const tags: ManifestTag[] = []
  for (const t of m.tags as Partial<ManifestTag>[]) {
    if (!t || !isSafeNotePath(t.path)) throw new Error(`${MANIFEST_FILE} has an unsafe note path: ${String(t?.path)}`)
    if (typeof t.hash !== 'string' || !/^[0-9a-f]{64}$/.test(t.hash)) throw new Error(`${MANIFEST_FILE} has a bad hash for ${t.path}`)
    // facet and source come from the manifest (never derived from the path); the path must agree with them
    const facet = str(t.facet)
    const source = str(t.source)
    if (facets.length && !facets.includes(facet)) throw new Error(`${MANIFEST_FILE} has an unknown facet "${facet}" in ${t.path}`)
    if (source !== 'core' && !teams.some((x) => x.id === source)) throw new Error(`${MANIFEST_FILE} has an unknown source in ${t.path}`)
    const base = source === 'core' ? 'core/' : `teams/${source}/`
    const rest = t.path.startsWith(base) ? t.path.slice(base.length) : ''
    const name = rest.split('/')
    if (name.length !== 2 || name[0] !== facet || str(t.tag) !== `${facet}/${name[1].slice(0, -3)}`) {
      throw new Error(`${MANIFEST_FILE} entry does not match its path: ${t.path}`)
    }
    const status = t.status === 'deprecated' || t.status === 'proposed' ? t.status : 'active'
    tags.push({
      tag: t.tag as string,
      facet,
      source,
      status,
      replaced_by: t.replaced_by ? String(t.replaced_by) : null,
      aliases: Array.isArray(t.aliases) ? t.aliases.map(String) : [],
      definition: str(t.definition),
      path: t.path,
      hash: t.hash,
    })
  }
  return { version: 2, facets, teams, tags }
}

export interface MergedManifest extends Manifest {
  /** Index into the source list for each tag, parallel to `tags`. */
  origin: number[]
  warnings: string[]
}

/** Union of several registries. On a duplicate tag the earlier source wins and a warning is recorded. */
export function mergeManifests(manifests: Manifest[]): MergedManifest {
  const out: MergedManifest = { version: 2, facets: [], teams: [], tags: [], origin: [], warnings: [] }
  const tagAt = new Map<string, number>()
  const pathAt = new Set<string>()
  manifests.forEach((m, idx) => {
    for (const f of m.facets) if (!out.facets.includes(f)) out.facets.push(f)
    for (const t of m.teams) if (!out.teams.some((x) => x.id === t.id)) out.teams.push(t)
    for (const t of m.tags) {
      if (tagAt.has(t.tag) || pathAt.has(t.path)) {
        out.warnings.push(`${t.tag} is defined by more than one source; using the first`)
        continue
      }
      tagAt.set(t.tag, idx)
      pathAt.add(t.path)
      out.tags.push(t)
      out.origin.push(idx)
    }
  })
  return out
}

export interface TeamFilterOptions {
  /** Also keep the ancestors of each selected team (default true). */
  includeAncestors?: boolean
  /** With `allTeams`, also keep placeholder (`example`) teams (default false). */
  showExamples?: boolean
}

/** Keep the core plus the chosen teams (and their ancestors), or every non-example team. */
export function filterTeams<T extends { tags: ManifestTag[]; teams?: ManifestTeam[] }>(m: T, teams: string[], allTeams: boolean, opts: TeamFilterOptions = {}): ManifestTag[] {
  const known = m.teams ?? []
  const wanted = new Set(teams)
  if (opts.includeAncestors !== false) {
    for (const id of teams) {
      for (let p = known.find((t) => t.id === id)?.parent; p && !wanted.has(p); p = known.find((t) => t.id === p)?.parent) wanted.add(p)
    }
  }
  const hidden = new Set(opts.showExamples ? [] : known.filter((t) => t.example).map((t) => t.id))
  return m.tags.filter((t) => t.source === 'core' || (allTeams ? !hidden.has(t.source) : wanted.has(t.source)))
}
