import { createLogger, LogLevel } from '../src/core/log'
import { RegistryError, RegistrySource } from '../src/core/sources'
import {
  conformingFacet,
  normalizeTag,
  planTagPages,
  runCreateTagPages,
  TAG_PAGE_FOLDER_OVERLAP,
  tagPageFolderError,
  TagPageEnv,
  TagPageItem,
  TagPagePlan,
  tagPageText,
} from '../src/core/tagPages'
import { normalizeSettings } from '../src/settings'
import { entry, FakeVault, mf, note } from './helpers'

describe('normalizeTag', () => {
  it.each([
    ['#Area/Home', 'area/home'],
    [' tool/git ', 'tool/git'],
    ['#project/x', 'project/x'],
  ])('%p -> %p', (raw, out) => expect(normalizeTag(raw)).toBe(out))
})

describe('conformingFacet (R-TP-2.3)', () => {
  it('accepts <facet>/<name> in kebab case', () => expect(conformingFacet('project/wifi-router', [])).toBe('project'))
  it('checks the facet when facets are known', () => {
    expect(conformingFacet('project/x', ['project'])).toBe('project')
    expect(conformingFacet('todo/x', ['project'])).toBeNull()
  })
  it.each(['todo', 'project/x/y', 'project/Wifi', 'project/wifi_router', 'project/', '/x'])('rejects %p', (t) => expect(conformingFacet(t, [])).toBeNull())
})

describe('tagPageFolderError (R-TP-1.2)', () => {
  it.each([
    ['Tags/_local', 'Tags'],
    ['Tag pages', 'Tags'],
    ['Tags/Local Pages', 'Tags'],
  ])('accepts %p beside destination %p', (f, d) => expect(tagPageFolderError(f, d)).toBeNull())
  it.each([
    ['Tags', 'Tags'],
    ['tags/', 'Tags'],
    ['Tags/local', 'Tags'],
    ['Tags/Core', 'Tags'],
    ['Tags/my-team/x', 'Tags'],
  ])('rejects %p as overlapping %p', (f, d) => expect(tagPageFolderError(f, d)).toBe(TAG_PAGE_FOLDER_OVERLAP))
  it.each(['', '../x', '.hidden', 'a/.obsidian', '/abs'])('rejects unsafe %p', (f) => expect(tagPageFolderError(f, 'Tags')).toBe('Choose a normal vault folder (no hidden folders)'))
})

describe('planTagPages (R-TP-2)', () => {
  const base = { paged: [] as string[], registryTags: [] as string[], facets: [] as string[], folder: 'Tags/_local/' }
  it('plans a page per conforming tag, merging case variants and summing uses', () => {
    const plan = planTagPages({ ...base, used: { '#project/b': 1, '#Project/A': 2, '#project/a': 1 } })
    expect(plan.create).toEqual([
      { tag: 'project/a', facet: 'project', vaultPath: 'Tags/_local/project/a.md', uses: 3 },
      { tag: 'project/b', facet: 'project', vaultPath: 'Tags/_local/project/b.md', uses: 1 },
    ])
  })
  it('skips tags that already have a page, whatever its case or folder', () => {
    const plan = planTagPages({ ...base, used: { '#project/a': 1 }, paged: ['#Project/A'] })
    expect(plan.create).toEqual([])
    expect(plan.skipped).toEqual({ paged: 1, registry: 0, nonconforming: 0 })
  })
  it('never stubs a tag a registry defines (the import brings that page)', () => {
    const plan = planTagPages({ ...base, used: { '#tool/git': 4 }, registryTags: ['tool/git'] })
    expect(plan.create).toEqual([])
    expect(plan.skipped.registry).toBe(1)
  })
  it('counts tags that do not fit <facet>/<name> as grooming candidates', () => {
    const plan = planTagPages({ ...base, used: { '#todo': 1, '#project/a/b': 1, '#idea/x': 1 }, facets: ['project'] })
    expect(plan.create).toEqual([])
    expect(plan.skipped.nonconforming).toBe(3)
  })
})

describe('tagPageText (R-TP-4)', () => {
  it('uses the registry note format with the tag as an alias and no stamp', () => {
    const t = tagPageText('project/wifi-router', 'project')
    expect(t).toBe('---\ntag: project/wifi-router\naliases: ["#project/wifi-router"]\nfacet: project\nstatus: proposed\nreplaced_by:\nowner: local\n---\n\n# project/wifi-router\n\nDefinition:\n')
    expect(t).not.toMatch(/glossary_hash/)
  })
})

function setup(over: { settings?: unknown; used?: Record<string, number>; paged?: string[]; confirm?: (p: TagPagePlan) => TagPageItem[] | null; source?: Partial<RegistrySource> } = {}) {
  const settings = normalizeSettings({ sources: [{ id: 's1', repoUrl: 'https://github.com/o/r', authMethod: 'https' }], ...(over.settings as object) })
  const vault = new FakeVault()
  const notices: string[] = []
  const lines: string[] = []
  const excluded: string[][] = []
  const confirmed: TagPagePlan[] = []
  const git = note('tool/git')
  const source: RegistrySource = {
    method: 'https',
    fetchManifest: async () => JSON.stringify({ ...mf([entry('core/tool/git.md', git)]), facets: ['project', 'tool'] }),
    fetchNote: async () => git,
    ...over.source,
  }
  const env: TagPageEnv = {
    settings,
    getToken: () => '',
    makeSource: () => source,
    scan: async (exclude) => (excluded.push(exclude), { used: over.used ?? { '#project/a': 2, '#tool/git': 1, '#todo': 1 }, paged: over.paged ?? [] }),
    vault,
    confirm: async (plan) => (confirmed.push(plan), over.confirm ? over.confirm(plan) : plan.create),
    notice: (m) => void notices.push(m),
    log: createLogger((level: LogLevel, m, d) => void lines.push(`${level}: ${m} ${JSON.stringify(d ?? {})}`), () => true),
  }
  return { env, settings, vault, notices, lines, excluded, confirmed }
}

describe('runCreateTagPages (R-TP-3)', () => {
  it('creates only the confirmed pages, skipping registry tags and non-conforming ones', async () => {
    const t = setup()
    await runCreateTagPages(t.env)
    expect([...t.vault.files.keys()]).toEqual(['Tags/_local/project/a.md'])
    expect(t.vault.files.get('Tags/_local/project/a.md')).toBe(tagPageText('project/a', 'project'))
    expect(t.confirmed[0].skipped).toEqual({ paged: 0, registry: 1, nonconforming: 1 })
    expect(t.notices).toEqual(['Tag pages: 1 page created'])
  })

  it('excludes the tag page folder and the destination from the usage scan', async () => {
    const t = setup()
    await runCreateTagPages(t.env)
    expect(t.excluded).toEqual([['Tags/_local', 'Tags']])
  })

  it('writes nothing when the user cancels', async () => {
    const t = setup({ confirm: () => null })
    await runCreateTagPages(t.env)
    expect(t.vault.writes).toBe(0)
    expect(t.notices).toEqual([])
  })

  it('writes nothing and opens nothing when no page is missing', async () => {
    const t = setup({ used: { '#project/a': 1 }, paged: ['#project/a'] })
    await runCreateTagPages(t.env)
    expect(t.confirmed).toEqual([])
    expect(t.vault.writes).toBe(0)
    expect(t.notices).toEqual(['Tag pages: none missing (1 already have a page)'])
  })

  it('never overwrites a note that already sits at the page path', async () => {
    const t = setup()
    t.vault.files.set('Tags/_local/project/a.md', 'mine')
    await runCreateTagPages(t.env)
    expect(t.vault.files.get('Tags/_local/project/a.md')).toBe('mine')
    expect(t.vault.writes).toBe(0)
    expect(t.notices[0]).toMatch(/0 pages created, 1 skipped/)
  })

  it('aborts with no writes when a configured registry fails', async () => {
    const t = setup({ source: { fetchManifest: async () => Promise.reject(new RegistryError('https', 'HTTP 404')) } })
    await runCreateTagPages(t.env)
    expect(t.confirmed).toEqual([])
    expect(t.vault.writes).toBe(0)
    expect(t.notices[0]).toMatch(/No notes were changed\.$/)
  })

  it('works without a registry, accepting any kebab-case facet', async () => {
    const t = setup({ settings: { sources: [{ repoUrl: '' }] }, used: { '#idea/x': 1, '#tool/git': 1 } })
    await runCreateTagPages(t.env)
    expect([...t.vault.files.keys()].sort()).toEqual(['Tags/_local/idea/x.md', 'Tags/_local/tool/git.md'])
  })

  it('refuses an overlapping folder before scanning', async () => {
    const t = setup({ settings: { tagPageFolder: 'Tags' } })
    await runCreateTagPages(t.env)
    expect(t.excluded).toEqual([])
    expect(t.notices).toEqual([`Tag pages: ${TAG_PAGE_FOLDER_OVERLAP}`])
  })

  it('logs counts only, never tags or paths (invariant 5)', async () => {
    const t = setup()
    await runCreateTagPages(t.env)
    expect(t.lines.join('\n')).not.toMatch(/project\/a|_local|Tags/)
  })
})
