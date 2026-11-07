import { ImportEnv, ImportVault, PreviewResult, fetchTeams, runImport } from '../src/core/importer'
import { RegistryError, RegistrySource } from '../src/core/sources'
import { sha256, stamp } from '../src/core/stamp'
import { normalizeSettings } from '../src/settings'
import { FakeVault, entry, mf, note, team } from './helpers'

class StampVault extends FakeVault implements ImportVault {
  async listStamped(dest: string) {
    return [...this.files].filter(([p, t]) => p.startsWith(dest + '/') && /^glossary_hash:/m.test(t)).map(([p]) => p)
  }
}

const gitNote = note('tool/git')
const ghNote = note('tool/github')
const teamNote = note('project/x')
const NOTES: Record<string, string> = { 'core/tool/git.md': gitNote, 'core/tool/github.md': ghNote, 'teams/dave/project/x.md': teamNote }
const manifest = () =>
  mf(
    Object.entries(NOTES).map(([p, t]) => entry(p, t)),
    [team('dave', { name: 'Dave', description: 'd' })],
  )

function setup(over: { settings?: unknown; source?: Partial<RegistrySource>; preview?: PreviewResult | null; manifestText?: string } = {}) {
  const settings = normalizeSettings({ sources: [{ id: 's1', repoUrl: 'https://github.com/o/r', authMethod: 'https' }], ...(over.settings as object) })
  const vault = new StampVault()
  const notices: string[] = []
  const warns: string[] = []
  const fetched: string[] = []
  const saves = { n: 0 }
  const source: RegistrySource = {
    method: 'https',
    fetchManifest: async () => over.manifestText ?? JSON.stringify(manifest()),
    fetchNote: async (p) => (fetched.push(p), NOTES[p]),
    ...over.source,
  }
  const env: ImportEnv = {
    settings,
    saveSettings: async () => void saves.n++,
    getToken: () => '',
    makeSource: () => source,
    vault,
    notice: (m) => void notices.push(m),
    preview: async (plan) =>
      over.preview !== undefined ? over.preview : { decisions: plan.items.filter((i) => i.category !== 'conflict').map((item) => ({ item })), renames: [] },
    countUsages: async () => 0,
    renameUsages: async () => 3,
    warn: (m) => void warns.push(m),
  }
  return { env, settings, vault, notices, warns, fetched, saves }
}

describe('runImport: configuration guards (R-IMP-1.2, 1.3)', () => {
  it('interactive: tells the user to set a URL and does nothing else', async () => {
    const t = setup({ settings: { sources: [{ repoUrl: '  ' }] } })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.notices).toEqual(['Tags: set a registry URL in the plugin settings first'])
    expect(t.fetched).toEqual([])
  })
  it('interactive: rejects a bad destination', async () => {
    const t = setup({ settings: { destFolder: '../x' } })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.notices).toEqual(['Tags: Choose a normal vault folder (no hidden folders)'])
    expect(t.vault.writes).toBe(0)
  })
  it.each(['notify', 'auto'] as const)('%s: stays silent on a configuration problem', async (mode) => {
    const t = setup({ settings: { destFolder: '' } })
    await runImport(t.env, { mode })
    expect(t.notices).toEqual([])
    expect(t.vault.writes).toBe(0)
  })
})

describe('runImport: interactive', () => {
  it('imports core only by default, then is idempotent (R-IMP-10.1)', async () => {
    const t = setup()
    await runImport(t.env, { mode: 'interactive' })
    expect([...t.vault.files.keys()].sort()).toEqual(['Tags/core/tool/git.md', 'Tags/core/tool/github.md'])
    expect(t.notices.at(-1)).toBe('Tags: 2 new')
    t.vault.writes = 0
    await runImport(t.env, { mode: 'interactive' })
    expect(t.vault.writes).toBe(0)
    expect(t.notices.at(-1)).toBe('Tags: up to date')
  })

  it('includes a subscribed team under <dest>/<team>/', async () => {
    const t = setup({ settings: { teams: ['dave'] } })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.vault.files.has('Tags/dave/project/x.md')).toBe(true)
  })

  it('cancelling the preview writes nothing', async () => {
    const t = setup({ preview: null })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.vault.writes).toBe(0)
    expect(t.fetched).toEqual([])
  })

  it('applies the chosen renames and reports the count', async () => {
    const t = setup({ preview: { decisions: [], renames: [{ from: 'tool/old', to: 'tool/git' }] } })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.notices.at(-1)).toContain('Tags: nothing written. Renamed #tool/old in 3 notes')
  })

  it('records discovered teams once and does not re-save when unchanged (R-SUB-5.1)', async () => {
    const t = setup()
    await runImport(t.env, { mode: 'interactive' })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.settings.knownTeams).toEqual([{ id: 'dave', name: 'Dave', description: 'd', level: '', parent: null, example: false }])
    expect(t.saves.n).toBe(1)
  })

  it('a second concurrent request is ignored (R-IMP-1.4)', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const t = setup({ source: { fetchManifest: async () => (await gate, JSON.stringify(manifest())) } })
    const first = runImport(t.env, { mode: 'interactive' })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.notices).toEqual([])
    release()
    await first
    expect(t.vault.writes).toBe(2)
  })
})

describe('runImport: failures abort before any write (R-IMP-1.5)', () => {
  it('a failing source names the repo (without credentials) and says nothing changed', async () => {
    const t = setup({
      settings: { sources: [{ id: 's1', repoUrl: 'https://u:SECRET@github.com/o/r', authMethod: 'token', token: 'SECRET' }] },
      source: { method: 'token', fetchManifest: async () => Promise.reject(new RegistryError('token', 'authentication failed (HTTP 401)')) },
    })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.vault.writes).toBe(0)
    expect(t.notices).toHaveLength(1)
    expect(t.notices[0]).toBe('Registry (token): https://github.com/o/r: authentication failed (HTTP 401). No notes were changed.')
    expect(t.notices[0]).not.toContain('SECRET')
  })

  it('an invalid manifest is reported with the repo', async () => {
    const t = setup({ manifestText: '{"version":1,"tags":[]}' })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.notices[0]).toMatch(/https:\/\/github\.com\/o\/r: .*version 2.*No notes were changed/)
  })

  it('one bad source among several aborts the whole run', async () => {
    const t = setup({ settings: { sources: [{ id: 'a', repoUrl: 'https://github.com/o/r' }, { id: 'b', repoUrl: 'https://github.com/o/bad' }] } })
    let n = 0
    t.env.makeSource = () => ({
      method: 'https',
      fetchManifest: async () => (++n === 2 ? Promise.reject(new Error('boom')) : JSON.stringify(manifest())),
      fetchNote: async (p) => NOTES[p],
    })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.vault.writes).toBe(0)
    expect(t.notices[0]).toContain('https://github.com/o/bad')
  })

  it('a note that fails to download writes nothing', async () => {
    const t = setup({ source: { fetchNote: async (p) => (p.endsWith('github.md') ? Promise.reject(new Error('503')) : NOTES[p]) } })
    await runImport(t.env, { mode: 'interactive' })
    expect(t.vault.writes).toBe(0)
    expect(t.notices[0]).toContain('No notes were changed')
  })

  it.each(['notify', 'auto'] as const)('%s: failures are logged, never shown as a blocking notice (R-IMP-9.4)', async (mode) => {
    const t = setup({ manifestText: 'not json' })
    await runImport(t.env, { mode })
    expect(t.notices).toEqual([])
    expect(t.warns.join()).toMatch(/import failed/)
  })
})

describe('runImport: notify (R-IMP-9.2)', () => {
  it('never writes or fetches notes, and tells the user what is pending', async () => {
    const t = setup({ settings: { startupMode: 'notify' } })
    await runImport(t.env, { mode: 'notify' })
    expect(t.vault.writes).toBe(0)
    expect(t.fetched).toEqual([])
    expect(t.notices).toEqual(['Tags: 2 new. Run "Import / update tags" to review.'])
  })
  it('is silent when up to date', async () => {
    const t = setup()
    await runImport(t.env, { mode: 'interactive' })
    t.notices.length = 0
    await runImport(t.env, { mode: 'notify' })
    expect(t.notices).toEqual([])
  })
})

describe('runImport: auto (R-IMP-9.3)', () => {
  it('applies new and updated without asking and leaves conflicts untouched', async () => {
    const t = setup()
    const mine = 'my own page'
    t.vault.files.set('Tags/core/tool/git.md', mine) // unstamped + different -> conflict
    let asked = false
    t.env.preview = async () => ((asked = true), null)
    await runImport(t.env, { mode: 'auto' })
    expect(asked).toBe(false)
    expect(t.vault.files.get('Tags/core/tool/git.md')).toBe(mine)
    expect(t.vault.files.get('Tags/core/tool/github.md')).toBe(stamp(ghNote, sha256(ghNote)))
    expect(t.fetched).toEqual(['core/tool/github.md'])
    expect(t.notices).toEqual(['Tags: 1 new. 1 conflict needs review'])
  })

  it('updates an untouched older copy', async () => {
    const t = setup()
    const old = note('tool/git', 'old')
    t.vault.files.set('Tags/core/tool/git.md', stamp(old, sha256(old)))
    await runImport(t.env, { mode: 'auto' })
    expect(t.notices[0]).toContain('1 updated')
  })

  it('does nothing and says nothing when up to date', async () => {
    const t = setup()
    await runImport(t.env, { mode: 'auto' })
    t.notices.length = 0
    t.vault.writes = 0
    await runImport(t.env, { mode: 'auto' })
    expect(t.vault.writes).toBe(0)
    expect(t.notices).toEqual([])
  })

  it('never performs renames', async () => {
    const dep = mf([entry('core/tool/old.md', note('tool/old'), { status: 'deprecated', replaced_by: 'tool/git' })])
    NOTES['core/tool/old.md'] = note('tool/old')
    const t = setup({ manifestText: JSON.stringify(dep) })
    const rename = jest.fn()
    t.env.renameUsages = rename
    await runImport(t.env, { mode: 'auto' })
    delete NOTES['core/tool/old.md']
    expect(rename).not.toHaveBeenCalled()
  })
})

describe('runImport: orphans (R-IMP-8)', () => {
  it('reports stamped notes that left the subscription and never deletes them', async () => {
    const t = setup()
    t.vault.files.set('Tags/dave/project/x.md', stamp(teamNote, sha256(teamNote))) // team not subscribed
    t.vault.files.set('Tags/core/tool/git (glossary).md', stamp(gitNote, sha256(gitNote))) // a saved copy is not an orphan
    await runImport(t.env, { mode: 'interactive' })
    expect(t.notices.at(-1)).toBe('Tags: 2 new (1 imported note is no longer in your subscription)')
    expect(t.vault.files.has('Tags/dave/project/x.md')).toBe(true)
  })
})

describe('fetchTeams (R-SUB-5)', () => {
  it('stores the union of teams', async () => {
    const t = setup()
    expect(await fetchTeams(t.env)).toBeNull()
    expect(t.settings.knownTeams.map((x) => x.id)).toEqual(['dave'])
  })
  it('keeps the previous teams and selection when a source fails (R-SUB-5.3)', async () => {
    const t = setup({ settings: { teams: ['dave'], knownTeams: [{ id: 'dave', name: 'Dave' }] }, manifestText: 'oops' })
    const err = await fetchTeams(t.env)
    expect(err).toMatch(/Registry \(https\)/)
    expect(t.settings.knownTeams).toHaveLength(1)
    expect(t.settings.teams).toEqual(['dave'])
    expect(t.saves.n).toBe(0)
  })
  it('asks for a URL when none is set', async () => {
    expect(await fetchTeams(setup({ settings: { sources: [{ repoUrl: '' }] } }).env)).toMatch(/registry URL/)
  })
})
