import { buildReport, snapshotFromSettings } from '../src/core/diagnostics'
import { normalizeSettings } from '../src/settings'

const env = { pluginVersion: '0.1.0', obsidianVersion: '1.8.0', platform: 'win32', arch: 'x64', secretStorage: true }

describe('diagnostics (R-FND-5)', () => {
  const settings = normalizeSettings({
    sources: [
      { id: 'SENTINEL_ID', repoUrl: 'https://alice:SENTINEL_CRED@github.com/SENTINEL_ORG/SENTINEL_REPO', ref: 'SENTINEL_REF', authMethod: 'token', token: 'SENTINEL_TOKEN' },
      { id: 'b', repoUrl: 'https://gitlab.corp/SENTINEL_GROUP/r', authMethod: 'https' },
      { id: 'c', repoUrl: '', authMethod: 'git' },
    ],
    teams: ['SENTINEL_TEAM', 'two'],
    knownTeams: [{ id: 'SENTINEL_TEAM', name: 'SENTINEL_TEAM_NAME', description: 'SENTINEL_DESC' }],
    destFolder: 'SENTINEL_FOLDER/Private',
    startupMode: 'auto',
  })
  const out = buildReport(snapshotFromSettings(settings, env))

  it('reports only versions, counts and modes', () => {
    expect(out).toContain('Plugin: 0.1.0')
    expect(out).toContain('Obsidian: 1.8.0')
    expect(out).toContain('OS: win32 x64')
    expect(out).toContain('Sources: 2') // the empty row is not a source
    expect(out).toContain('Access methods: token, https')
    expect(out).toContain('Selected teams: 2')
    expect(out).toContain('Startup mode: auto')
    expect(out).toContain('Secret storage available: yes')
  })

  it('leaks no sentinel from any sensitive field', () => {
    expect(out).not.toMatch(/SENTINEL|alice|github\.com|gitlab/i)
  })

  it('says all when every team is subscribed, and none when nothing is configured', () => {
    expect(buildReport(snapshotFromSettings({ ...settings, allTeams: true }, env))).toContain('Selected teams: all')
    expect(buildReport(snapshotFromSettings(normalizeSettings(null), { ...env, secretStorage: false }))).toMatch(/Sources: 0[\s\S]*Access methods: none[\s\S]*Secret storage available: no/)
  })
})
