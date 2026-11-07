import { destError } from '../src/core/destination'
import { hasSecretStorage, getToken, setToken, clearToken, secretId } from '../src/host/secrets'
import { defaultSettings, normalizeSettings } from '../src/settings'

describe('normalizeSettings (R-SUB-9, R-FND-4)', () => {
  it.each([undefined, null, 5, 'x', [], {}])('returns usable defaults for %p', (raw) => {
    const s = normalizeSettings(raw)
    expect(s).toMatchObject({ schemaVersion: 1, destFolder: 'Tags', startupMode: 'notify', teams: [], allTeams: false, knownTeams: [] })
    expect(s.sources).toHaveLength(1)
    expect(s.sources[0]).toMatchObject({ repoUrl: '', ref: 'main', authMethod: 'https' })
  })

  it('ships one empty source and no default registry URL (R-SUB-1.3)', () => {
    expect(defaultSettings().sources.map((x) => x.repoUrl)).toEqual([''])
  })

  it('validates each field independently', () => {
    const s = normalizeSettings({ sources: 'nope', teams: [1, 'dave', null], allTeams: 'yes', knownTeams: [{ id: 'a' }, 7, { name: 'no id' }], destFolder: 9, startupMode: 'sometimes' })
    expect(s.teams).toEqual(['dave'])
    expect(s.allTeams).toBe(false)
    expect(s.knownTeams).toEqual([{ id: 'a', name: 'a', description: '', level: '', parent: null, example: false }])
    expect(s.destFolder).toBe('Tags')
    expect(s.startupMode).toBe('notify')
    expect(s.sources).toHaveLength(1)
  })

  it('treats an unknown authMethod as https and keeps good fields', () => {
    const s = normalizeSettings({ sources: [{ id: 'a', repoUrl: 'https://github.com/o/r', ref: '', authMethod: 'ssh', token: 't' }, null] })
    expect(s.sources).toEqual([{ id: 'a', repoUrl: 'https://github.com/o/r', ref: 'main', authMethod: 'https', token: 't' }])
  })

  it('keeps source ids unique because they key secrets', () => {
    const s = normalizeSettings({ sources: [{ id: 'a' }, { id: 'a' }] })
    expect(new Set(s.sources.map((x) => x.id)).size).toBe(2)
  })

  it.each(['off', 'notify', 'auto'])('keeps startupMode %s', (mode) => {
    expect(normalizeSettings({ startupMode: mode }).startupMode).toBe(mode)
  })

  it('ignores keys from other plugins and the old format (R-FND-4.2)', () => {
    const s = normalizeSettings({ jobs: [1], tagReview: {}, executor: 'x', glossary: { repoUrl: 'https://github.com/o/r' }, checkOnStartup: true, destFolder: 'G', schemaVersion: 2 })
    expect(Object.keys(s).sort()).toEqual(['allTeams', 'destFolder', 'includeAncestors', 'knownTeams', 'schemaVersion', 'showExampleTeams', 'sources', 'startupMode', 'teams'])
    expect(s.destFolder).toBe('G')
    expect(s.schemaVersion).toBe(1)
    expect(s.sources[0].repoUrl).toBe('')
    expect(s.startupMode).toBe('notify')
  })
})

describe('destError (R-SUB-7.2)', () => {
  it.each(['Tags', 'a/b', ' Tags/ ', 'Tags/'])('accepts %p', (d) => expect(destError(d)).toBeNull())
  it.each(['', '  ', '/', '/abs', 'C:\\x', 'C:/x', 'a\\b', '../x', 'a/../b', '.hidden', 'a/.obsidian', 'a//b'])('rejects %p', (d) => {
    expect(destError(d)).toBe('Choose a normal vault folder (no hidden folders)')
  })
})

describe('secrets (R-SUB-4)', () => {
  const src = () => ({ id: 'src-1', repoUrl: '', ref: 'main', authMethod: 'token' as const, token: '' })
  it('uses secret storage when present and keeps data.json token empty', () => {
    const store = new Map<string, string>()
    const app = { secretStorage: { getSecret: (id: string) => store.get(id) ?? null, setSecret: (id: string, v: string) => void store.set(id, v) } }
    const s = src()
    expect(hasSecretStorage(app)).toBe(true)
    setToken(app, s, 'TOKEN')
    expect(s.token).toBe('')
    expect(store.get('tag-registry-client-token-src-1')).toBe('TOKEN')
    expect(getToken(app, s)).toBe('TOKEN')
    clearToken(app, s)
    expect(getToken(app, s)).toBe('')
  })
  it('falls back to data.json when secret storage is missing or incomplete', () => {
    for (const app of [{}, { secretStorage: {} }, { secretStorage: { getSecret: () => null } }]) {
      const s = src()
      expect(hasSecretStorage(app)).toBe(false)
      setToken(app, s, 'TOKEN')
      expect(s.token).toBe('TOKEN')
      expect(getToken(app, s)).toBe('TOKEN')
      clearToken(app, s)
      expect(s.token).toBe('')
    }
  })
  it('secret id format', () => expect(secretId({ id: 'x' })).toBe('tag-registry-client-token-x'))
})
