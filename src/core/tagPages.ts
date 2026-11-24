import type { RegistrySettings, SourceSetting } from '../settings'
import { destError, normalizeDest } from './destination'
import { loadRegistries } from './importer'
import { Logger } from './log'
import { mergeManifests } from './manifest'
import { RegistryError, RegistrySource, SourceConfig } from './sources'

/**
 * Tag pages for tags you use in the vault that no registry defines (R-TP-*). A tag page is an ordinary note whose
 * `aliases` contain `#<tag>`, the convention Tag Wrangler and the registry's own notes use. Registry tags get their
 * page from the import, so they are never stubbed here.
 */

const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const TAG_PAGE_FOLDER_OVERLAP = 'Choose a folder that is not the destination folder or a team folder inside it'

/** `#Area/Home ` -> `area/home`. Obsidian treats tags case-insensitively, so comparisons use this form. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase()
}

/**
 * The tag page folder must be a normal vault folder (same rule as the destination) and must not collide with the
 * import destination: not the destination itself, and not a folder inside it that a team or `core` could use.
 * Compared case-insensitively because Windows and macOS file systems are.
 */
export function tagPageFolderError(folder: string, dest: string): string | null {
  const bad = destError(folder)
  if (bad) return bad
  const f = normalizeDest(folder).toLowerCase()
  const d = normalizeDest(dest).toLowerCase()
  if (!d) return null
  if (f === d) return TAG_PAGE_FOLDER_OVERLAP
  if (f.startsWith(d + '/') && SEGMENT.test(f.slice(d.length + 1).split('/')[0])) return TAG_PAGE_FOLDER_OVERLAP
  return null
}

/** `<facet>/<name>` with kebab-case segments and, when the facets are known, a known facet. */
export function conformingFacet(tag: string, facets: string[]): string | null {
  const parts = tag.split('/')
  if (parts.length !== 2 || !parts.every((s) => SEGMENT.test(s))) return null
  if (facets.length && !facets.includes(parts[0])) return null
  return parts[0]
}

export interface TagPageItem {
  /** Normalized tag without `#`. */
  tag: string
  facet: string
  vaultPath: string
  /** Notes that use the tag. */
  uses: number
}

export interface TagPagePlan {
  create: TagPageItem[]
  skipped: {
    /** Already have a page (a note with the tag as an alias). */
    paged: number
    /** Defined by a configured registry; "Import / update tags" brings their pages. */
    registry: number
    /** Not `<facet>/<name>` in kebab case, or an unknown facet. Grooming candidates. */
    nonconforming: number
  }
}

export interface TagPageInputs {
  /** Tag (any case, with or without `#`) -> number of notes using it. */
  used: Record<string, number>
  /** Tags that already have a page, from note aliases. */
  paged: Iterable<string>
  /** Every tag any configured registry defines, whatever the subscription. */
  registryTags: Iterable<string>
  /** Allowed facets; empty means any kebab-case facet. */
  facets: string[]
  folder: string
}

/** Pure: which pages to create and why the rest were skipped. Sorted by tag. */
export function planTagPages(input: TagPageInputs): TagPagePlan {
  const paged = new Set([...input.paged].map(normalizeTag))
  const registry = new Set([...input.registryTags].map(normalizeTag))
  const used = new Map<string, number>()
  for (const [raw, n] of Object.entries(input.used)) {
    const t = normalizeTag(raw)
    if (t) used.set(t, (used.get(t) ?? 0) + n)
  }
  const folder = normalizeDest(input.folder)
  const plan: TagPagePlan = { create: [], skipped: { paged: 0, registry: 0, nonconforming: 0 } }
  for (const [tag, uses] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    if (paged.has(tag)) plan.skipped.paged++
    else if (registry.has(tag)) plan.skipped.registry++
    else {
      const facet = conformingFacet(tag, input.facets)
      if (!facet) plan.skipped.nonconforming++
      else plan.create.push({ tag, facet, vaultPath: `${folder}/${tag}.md`, uses })
    }
  }
  return plan
}

/**
 * A local tag page in the registry's note format, so it can later be proposed upstream by moving it into a team
 * folder and setting `owner`. No `glossary_hash` stamp: the import never treats it as one of its own notes.
 */
export function tagPageText(tag: string, facet: string): string {
  return [
    '---',
    `tag: ${tag}`,
    `aliases: ["#${tag}"]`,
    `facet: ${facet}`,
    'status: proposed',
    'replaced_by:',
    'owner: local',
    '---',
    '',
    `# ${tag}`,
    '',
    'Definition:',
    '',
  ].join('\n')
}

export interface TagPageScan {
  used: Record<string, number>
  paged: string[]
}

export interface TagPageEnv {
  settings: RegistrySettings
  getToken(src: SourceSetting): string
  makeSource(cfg: SourceConfig): RegistrySource
  /** Tags used in notes outside `exclude` folders, and tags that already have a page anywhere in the vault. */
  scan(exclude: string[]): Promise<TagPageScan>
  vault: { read(path: string): Promise<string | null>; create(path: string, content: string): Promise<void> }
  /** Resolves to the items the user kept, or null on cancel. */
  confirm(plan: TagPagePlan): Promise<TagPageItem[] | null>
  notice(message: string, ms?: number): void
  log: Logger
}

let running = false

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function skippedSummary(s: TagPagePlan['skipped']): string {
  return [
    s.paged && `${s.paged} already have a page`,
    s.registry && `${s.registry} come from your registries (use "Import / update tags")`,
    s.nonconforming && `${s.nonconforming} don't fit <facet>/<name>`,
  ]
    .filter(Boolean)
    .join('; ')
}

/** "Create missing tag pages": scan, plan, confirm, then create. Nothing is written before the user confirms. */
export async function runCreateTagPages(env: TagPageEnv): Promise<void> {
  const s = env.settings
  const log = env.log
  if (running) return
  const bad = tagPageFolderError(s.tagPageFolder, s.destFolder)
  if (bad) {
    env.notice(`Tag pages: ${bad}`)
    return
  }
  running = true
  const t0 = Date.now()
  let created = 0
  let writing = false
  try {
    // registries are optional here; when configured, all of them must load so no registry tag gets a local stub
    let facets: string[] = []
    let registryTags: string[] = []
    if (s.sources.some((x) => x.repoUrl.trim())) {
      const merged = mergeManifests((await loadRegistries(env)).manifests)
      facets = merged.facets
      registryTags = merged.tags.map((t) => t.tag)
    }
    const exclude = [normalizeDest(s.tagPageFolder), ...(destError(s.destFolder) ? [] : [normalizeDest(s.destFolder)])]
    const scan = await env.scan(exclude)
    const plan = planTagPages({ used: scan.used, paged: scan.paged, registryTags, facets, folder: s.tagPageFolder })
    log.debug('tag page plan', { create: plan.create.length, ...plan.skipped, ms: Date.now() - t0 })
    if (!plan.create.length) {
      const why = skippedSummary(plan.skipped)
      env.notice(`Tag pages: none missing${why ? ` (${why})` : ''}`, 8000)
      return
    }
    const chosen = await env.confirm(plan)
    if (!chosen) {
      log.debug('tag pages cancelled; nothing written')
      return
    }
    let existed = 0
    writing = true
    for (const item of chosen) {
      // a note at that path without the alias is the user's; never overwrite it
      if ((await env.vault.read(item.vaultPath)) !== null) {
        existed++
        continue
      }
      await env.vault.create(item.vaultPath, tagPageText(item.tag, item.facet))
      created++
    }
    log.debug('tag pages done', { created, existed, ms: Date.now() - t0 })
    env.notice(`Tag pages: ${plural(created, 'page')} created${existed ? `, ${existed} skipped because a note with that name exists` : ''}`, 8000)
  } catch (e) {
    log.error('tag pages failed', e)
    if (writing) env.notice(`Tag pages: stopped after ${plural(created, 'page')} created. See the developer console.`, 10000)
    else env.notice(`${e instanceof RegistryError ? e.message : `Registry: ${(e as Error).message}`}. No notes were changed.`, 10000)
  } finally {
    running = false
  }
}
