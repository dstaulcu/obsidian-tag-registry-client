import { filterTeams, mergeManifests, parseManifest } from '../src/core/manifest'
import { planImport } from '../src/core/plan'
import { readFileSync } from 'fs'
import { join } from 'path'
import { entry, mf, note, team } from './helpers'

const tag = { tag: 'tool/git', facet: 'tool', source: 'core', status: 'active', replaced_by: null, aliases: ['#tool/git'], definition: 'd', path: 'core/tool/git.md', hash: 'a'.repeat(64) }
const ok = { version: 2, facets: ['tool', 'project'], teams: [{ id: 'dave', name: 'Dave', description: 'x' }], tags: [tag] }
const parse = (m: unknown) => parseManifest(JSON.stringify(m))

describe('parseManifest', () => {
  it('accepts a valid manifest and keeps teams', () => {
    const m = parse(ok)
    expect(m.tags).toHaveLength(1)
    expect(m.teams[0].id).toBe('dave')
  })
  it('takes source and facet from the manifest and rejects a path that disagrees', () => {
    expect(parse({ ...ok, tags: [{ ...tag, tag: 'project/x', facet: 'project', source: 'dave', path: 'teams/dave/project/x.md' }] }).tags[0]).toMatchObject({ source: 'dave', facet: 'project' })
    expect(() => parse({ ...ok, tags: [{ ...tag, source: 'dave' }] })).toThrow(/does not match/)
    expect(() => parse({ ...ok, tags: [{ ...tag, facet: 'project' }] })).toThrow(/does not match/)
    expect(() => parse({ ...ok, tags: [{ ...tag, tag: 'tool/other' }] })).toThrow(/does not match/)
    expect(() => parse({ ...ok, tags: [{ ...tag, source: undefined }] })).toThrow(/unknown source/)
  })
  it('accepts nested teams and keeps level, parent and example', () => {
    const teams = [{ id: 'org', level: 'org', parent: null, example: true }, { id: 'org/comp', name: 'C', level: 'component', parent: 'org' }]
    const m = parse({ ...ok, teams, tags: [{ ...tag, tag: 'project/x', facet: 'project', source: 'org/comp', path: 'teams/org/comp/project/x.md' }] })
    expect(m.tags[0].source).toBe('org/comp')
    expect(m.teams).toEqual([
      { id: 'org', name: 'org', description: '', level: 'org', parent: null, example: true },
      { id: 'org/comp', name: 'C', description: '', level: 'component', parent: 'org', example: false },
    ])
  })
  it('ignores a top-level team named core and a parent that does not exist', () => {
    const m = parse({ ...ok, teams: [{ id: 'core' }, { id: 'a', parent: 'ghost' }] })
    expect(m.teams.map((t) => [t.id, t.parent])).toEqual([['a', null]])
  })
  it('parses a snapshot of the real registry.json', () => {
    const m = parseManifest(readFileSync(join(__dirname, 'fixtures/registry.json'), 'utf8'))
    expect(m.tags.length).toBeGreaterThan(0)
    expect(m.teams.find((t) => t.id === 'example-org/example-component')).toMatchObject({ parent: 'example-org', example: true })
    expect(m.tags.every((t) => t.source === 'core' || m.teams.some((x) => x.id === t.source))).toBe(true)
  })
  it('rejects version 1 and non-array tags (R-IMP-2.1)', () => {
    expect(() => parse({ ...ok, version: 1 })).toThrow(/version 2/)
    expect(() => parse({ ...ok, tags: {} })).toThrow(/version 2/)
    expect(() => parseManifest('{')).toThrow(/not valid JSON/)
  })
  it.each(['../x.md', '/abs.md', 'core/../x.md', '.hidden/x.md', 'other/tool/x.md', 'core/tool/x.txt', 'core/tool/a/b.md', 'core\\tool\\x.md', 'teams/dave/x.md', 'teams/dave/project/a/b.md', 'teams/core/project/x.md', 'teams/Dave/project/x.md', 'teams/.d/tool/x.md', 'core/Tool/x.md', 'core/tool/.x.md'])(
    'rejects path %s (R-IMP-2.2)',
    (path) => {
      expect(() => parse({ ...ok, tags: [{ ...tag, path }] })).toThrow()
    },
  )
  it.each(['zz', 'A'.repeat(64), 'a'.repeat(63), undefined])('rejects hash %s (R-IMP-2.3)', (hash) => {
    expect(() => parse({ ...ok, tags: [{ ...tag, hash }] })).toThrow(/bad hash/)
  })
  it('rejects a facet the manifest does not declare, but allows any when facets is empty', () => {
    expect(() => parse({ ...ok, tags: [{ ...tag, tag: 'bogus/x', facet: 'bogus', path: 'core/bogus/x.md' }] })).toThrow(/unknown facet/)
    expect(parse({ ...ok, facets: [], tags: [{ ...tag, tag: 'bogus/x', facet: 'bogus', path: 'core/bogus/x.md' }] }).tags).toHaveLength(1)
  })
  it('ignores teams with bad ids and defaults a missing status to active (R-IMP-2.5)', () => {
    const { status: _s, ...noStatus } = tag
    const m = parse({ ...ok, teams: [{ id: 'Bad Id' }, { id: 'ops' }], tags: [{ ...noStatus }] })
    expect(m.teams).toEqual([{ id: 'ops', name: 'ops', description: '', level: '', parent: null, example: false }])
    expect(m.tags[0].status).toBe('active')
  })
})

describe('teams, merging and layout', () => {
  const t1 = note('tool/git')
  const t2 = note('project/x')
  const core = mf([entry('core/tool/git.md', t1)])
  const teamM = mf([entry('teams/dave/project/x.md', t2), entry('teams/ops/project/y.md', t2)], [team('dave'), team('ops')])
  it('keeps the core plus selected teams, or all', () => {
    const m = mergeManifests([core, teamM])
    expect(filterTeams(m, [], false).map((t) => t.source)).toEqual(['core'])
    expect(filterTeams(m, ['dave'], false).map((t) => t.source)).toEqual(['core', 'dave'])
    expect(filterTeams(m, [], true)).toHaveLength(3)
    expect(m.teams.map((x) => x.id)).toEqual(['dave', 'ops'])
  })
  it('includes ancestors of a selected team unless turned off, and hides example teams from all-teams', () => {
    const tx = note('project/x')
    const nested = mf(
      [entry('teams/org/project/a.md', tx, { source: 'org' }), entry('teams/org/comp/project/b.md', tx, { source: 'org/comp' }), entry('teams/org/comp/sub/project/c.md', tx, { source: 'org/comp/sub' })],
      [team('org', { example: true }), team('org/comp', { parent: 'org', example: true }), team('org/comp/sub', { parent: 'org/comp' })],
    )
    expect(filterTeams(nested, ['org/comp'], false).map((t) => t.source)).toEqual(['org', 'org/comp'])
    expect(filterTeams(nested, ['org/comp'], false, { includeAncestors: false }).map((t) => t.source)).toEqual(['org/comp'])
    expect(filterTeams(nested, [], true).map((t) => t.source)).toEqual(['org/comp/sub'])
    expect(filterTeams(nested, [], true, { showExamples: true })).toHaveLength(3)
  })
  it('a selected team that no manifest lists simply matches nothing (id is retained by the caller)', () => {
    const m = mergeManifests([core, teamM])
    expect(filterTeams(m, ['ghost'], false).map((t) => t.source)).toEqual(['core'])
  })
  it('first source wins on a duplicate tag and the warning names the tag', () => {
    const m = mergeManifests([core, mf([entry('core/tool/git.md', t1)])])
    expect(m.tags).toHaveLength(1)
    expect(m.warnings).toEqual(['tool/git is defined by more than one source; using the first'])
  })
  it('mirrors core and team folders in the vault and records the origin (R-IMP-3.1)', async () => {
    const m = mergeManifests([core, teamM])
    const plan = await planImport(m, 'Tags', async () => null)
    expect(plan.items.map((i) => i.vaultPath)).toEqual(['Tags/core/tool/git.md', 'Tags/dave/project/x.md', 'Tags/ops/project/y.md'])
    expect(plan.items.map((i) => i.origin)).toEqual([0, 1, 1])
  })
})
