import type { RegistrySettings, SourceSetting } from '../settings'
import { applyImport, Decision, RegistryVault } from './apply'
import { Logger } from './log'
import { destError, normalizeDest } from './destination'
import { filterTeams, Manifest, mergeManifests, parseManifest } from './manifest'
import { findOrphans, ImportPlan, orphanSuffix, planImport, summarize } from './plan'
import { createSource, publicRepoUrl, RegistryError, RegistrySource, SourceConfig } from './sources'

export type ImportMode = 'interactive' | 'notify' | 'auto'

export interface Rename {
  from: string
  to: string
}

export interface PreviewResult {
  decisions: Decision[]
  renames: Rename[]
}

export interface ImportVault extends RegistryVault {
  /** Vault paths of markdown notes under `dest` that carry a `glossary_hash` stamp. */
  listStamped(dest: string): Promise<string[]>
}

/** Everything environment-specific the import needs, injected so the flow runs under node in tests. */
export interface ImportEnv {
  settings: RegistrySettings
  saveSettings(): Promise<void>
  getToken(src: SourceSetting): string
  makeSource(cfg: SourceConfig): RegistrySource
  vault: ImportVault
  notice(message: string, ms?: number): void
  /** Resolves the user's choices, or null if they cancel. Only used by `interactive`. */
  preview(plan: ImportPlan): Promise<PreviewResult | null>
  /** Notes outside `dest` using `#tag`, and the opt-in rewrite. */
  countUsages(dest: string, tag: string): Promise<number>
  renameUsages(dest: string, from: string, to: string): Promise<number>
  log: Logger
}

export interface Loaded {
  sources: RegistrySource[]
  manifests: Manifest[]
}

/** Fetch every configured source's manifest. One failure rejects with a message naming the repo (never credentials or tokens). */
export async function loadRegistries(env: Pick<ImportEnv, 'settings' | 'getToken' | 'makeSource' | 'log'>): Promise<Loaded> {
  const out: Loaded = { sources: [], manifests: [] }
  for (const s of env.settings.sources.filter((x) => x.repoUrl.trim())) {
    const cfg: SourceConfig = { repoUrl: s.repoUrl.trim(), ref: s.ref.trim() || 'main', method: s.authMethod, token: env.getToken(s) }
    const repo = publicRepoUrl(cfg.repoUrl)
    const t0 = Date.now()
    env.log.debug('fetching manifest', { repo, ref: cfg.ref, method: cfg.method, hasToken: !!cfg.token })
    const src = env.makeSource(cfg)
    try {
      const m = parseManifest(await src.fetchManifest())
      out.manifests.push(m)
      env.log.debug('manifest loaded', { repo, tags: m.tags.length, teams: m.teams.length, ms: Date.now() - t0 })
    } catch (e) {
      const inner = e instanceof RegistryError ? e.detail : (e as Error).message
      env.log.debug('manifest failed', { repo, method: cfg.method, ms: Date.now() - t0 })
      throw new RegistryError(cfg.method, `${repo}: ${inner}`)
    }
    out.sources.push(src)
  }
  return out
}

/** Record the teams seen upstream when they changed. */
export async function rememberTeams(env: Pick<ImportEnv, 'settings' | 'saveSettings'>, teams: RegistrySettings['knownTeams']): Promise<void> {
  if (JSON.stringify(env.settings.knownTeams) === JSON.stringify(teams)) return
  env.settings.knownTeams = teams
  await env.saveSettings()
}

/** "Fetch teams": returns an error message, or null on success. Settings are untouched on failure. */
export async function fetchTeams(env: Pick<ImportEnv, 'settings' | 'saveSettings' | 'getToken' | 'makeSource' | 'log'>): Promise<string | null> {
  if (!env.settings.sources.some((s) => s.repoUrl.trim())) return 'Set a registry URL first'
  try {
    const { manifests } = await loadRegistries(env)
    await rememberTeams(env, mergeManifests(manifests).teams)
    return null
  } catch (e) {
    env.log.debug('fetch teams failed')
    return (e as Error).message
  }
}

let running = false

export function failureMessage(e: unknown): string {
  const msg = e instanceof RegistryError ? e.message : `Registry: ${(e as Error).message}`
  return `${msg}. No notes were changed.`
}

function counts(parts: [number, string][]): string {
  return parts.filter(([n]) => n).map(([n, label]) => `${n} ${label}`).join(', ')
}

/** Fetch, plan and then (per mode) preview/apply. Failures abort before any write. */
export async function runImport(env: ImportEnv, opts: { mode: ImportMode }): Promise<void> {
  const { mode } = opts
  const interactive = mode === 'interactive'
  const s = env.settings
  const log = env.log
  if (running) {
    log.debug('import skipped: already running', { mode })
    return
  }
  if (!s.sources.some((x) => x.repoUrl.trim())) {
    log.debug('import skipped: no registry URL', { mode })
    if (interactive) env.notice('Tags: set a registry URL in the plugin settings first')
    return
  }
  const bad = destError(s.destFolder)
  if (bad) {
    log.debug('import skipped: destination rejected', { mode })
    if (interactive) env.notice(`Tags: ${bad}`)
    return
  }
  running = true
  const t0 = Date.now()
  log.debug('import started', { mode, sources: s.sources.filter((x) => x.repoUrl.trim()).length, allTeams: s.allTeams, teams: s.teams.length })
  try {
    const { sources, manifests } = await loadRegistries(env)
    const merged = mergeManifests(manifests)
    for (const w of merged.warnings) log.warn(w)
    await rememberTeams(env, merged.teams)

    const keep = new Set(filterTeams(merged, s.teams, s.allTeams, { includeAncestors: s.includeAncestors, showExamples: s.showExampleTeams }).map((t) => t.path))
    const picked = { tags: merged.tags.filter((t) => keep.has(t.path)), origin: merged.origin.filter((_, i) => keep.has(merged.tags[i].path)) }
    const dest = normalizeDest(s.destFolder)
    const plan = await planImport(picked, dest, (p) => env.vault.read(p))
    const orphans = findOrphans(plan.items.map((i) => i.vaultPath), await env.vault.listStamped(dest)).length
    const pending = plan.counts.new + plan.counts.updated + plan.counts.conflict
    log.debug('plan ready', { selected: picked.tags.length, ...plan.counts, orphans, ms: Date.now() - t0 })
    let fetchedNotes = 0
    let fetchMs = 0
    const fetchNote = async (item: { origin: number; entry: { path: string } }) => {
      const t = Date.now()
      try {
        return await sources[item.origin].fetchNote(item.entry.path)
      } finally {
        fetchedNotes++
        fetchMs += Date.now() - t
      }
    }
    const applied = (r: { created: number; updated: number }) =>
      log.debug('apply done', { fetched: fetchedNotes, fetchMs, created: r.created, updated: r.updated, ms: Date.now() - t0 })

    if (mode === 'notify') {
      log.debug('notify only; nothing written', { pending, ms: Date.now() - t0 })
      if (pending) env.notice(`${summarize(plan.counts)}${orphanSuffix(orphans)}. Run "Import / update tags" to review.`, 8000)
      return
    }

    if (mode === 'auto') {
      const decisions: Decision[] = plan.items.filter((i) => i.category === 'new' || i.category === 'updated').map((item) => ({ item }))
      const r = await applyImport(decisions, fetchNote, env.vault)
      applied(r)
      const wrote = counts([[r.created, 'new'], [r.updated, 'updated']])
      const c = plan.counts.conflict
      const review = c ? `${c} conflict${c > 1 ? 's need' : ' needs'} review` : ''
      if (wrote || review) env.notice(['Tags: ' + (wrote || 'nothing written'), review].filter(Boolean).join('. ') + orphanSuffix(orphans), 8000)
      return
    }

    const hasRename = plan.items.some((i) => i.entry.status === 'deprecated' && i.entry.replaced_by)
    if (!pending && !hasRename) {
      env.notice(summarize(plan.counts) + orphanSuffix(orphans))
      return
    }
    const choice = await env.preview(plan)
    if (!choice) {
      log.debug('preview cancelled; nothing written', { ms: Date.now() - t0 })
      return
    }
    const r = await applyImport(choice.decisions, fetchNote, env.vault)
    applied(r)
    const kept = choice.decisions.filter((d) => d.item.category === 'conflict' && (d.choice ?? 'keep') === 'keep').length
    let msg = counts([[r.created, 'new'], [r.updated, 'updated'], [r.copies.length, 'saved as copy'], [kept, 'kept as yours']])
    msg = msg ? `Tags: ${msg}` : 'Tags: nothing written'
    for (const rn of choice.renames) {
      const n = await env.renameUsages(dest, rn.from, rn.to)
      msg += `. Renamed #${rn.from} in ${n} note${n === 1 ? '' : 's'}`
    }
    env.notice(msg + orphanSuffix(orphans), 8000)
  } catch (e) {
    log.debug('import aborted', { mode, ms: Date.now() - t0 })
    if (interactive) {
      log.error('import failed', e)
      env.notice(failureMessage(e), 10000)
    } else {
      log.warn(`${mode} import failed: ${(e as Error).message}`)
    }
  } finally {
    running = false
  }
}
