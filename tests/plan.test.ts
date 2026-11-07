import { applyImport } from '../src/core/apply'
import { findOrphans, orphanSuffix, planImport, summarize } from '../src/core/plan'
import { readStamp, sha256, stamp, stripStamp } from '../src/core/stamp'
import { FakeVault, entry, mf, note } from './helpers'

describe('stamp', () => {
  it('round-trips: stripping a stamp restores the original text', () => {
    const t = note('tool/git')
    const h = sha256(t)
    expect(stripStamp(stamp(t, h))).toBe(t)
    expect(readStamp(stamp(t, h))).toBe(h)
  })
  it('adds front matter to a note that has none', () => {
    expect(stripStamp(stamp('# plain\n', 'a'.repeat(64)))).toBe('---\n---\n# plain\n')
  })
  it('puts the stamp last in the front matter', () => {
    expect(stamp('---\na: 1\n---\nbody\n', 'b'.repeat(64))).toBe(`---\na: 1\nglossary_hash: "${'b'.repeat(64)}"\n---\nbody\n`)
  })
})

describe('plan categories (R-IMP-3)', () => {
  const a = note('tool/git')
  const m = mf([entry('core/tool/git.md', a)])
  const cat = async (local: string | null) => (await planImport(m, 'Tags', async () => local)).items[0].category

  it('absent -> new', async () => expect(await cat(null)).toBe('new'))
  it('identical and stamped -> unchanged', async () => expect(await cat(stamp(a, sha256(a)))).toBe('unchanged'))
  it('identical but unstamped -> updated (to add the stamp)', async () => expect(await cat(a)).toBe('updated'))
  it('untouched since import but upstream moved -> updated', async () => {
    const old = note('tool/git', 'old')
    expect(await cat(stamp(old, sha256(old)))).toBe('updated')
  })
  it('edited locally -> conflict', async () => {
    const old = note('tool/git', 'old')
    expect(await cat(stamp(old, sha256(old)) + 'mine')).toBe('conflict')
  })
  it('counts deprecated tags separately', async () => {
    const dep = mf([entry('core/tool/old.md', a, { status: 'deprecated', replaced_by: 'tool/git' })])
    expect((await planImport(dep, 'Tags', async () => null)).counts.deprecated).toBe(1)
  })
})

describe('plan and apply', () => {
  const a = note('tool/git')
  const b = note('tool/github')
  const manifest = () => mf([entry('core/tool/git.md', a), entry('core/tool/github.md', b)])
  const fetchNote = async (i: { entry: { path: string } }) => (i.entry.path === 'core/tool/git.md' ? a : b)
  const run = async (v: FakeVault, m = manifest(), choice?: 'keep' | 'theirs' | 'copy', f = fetchNote) => {
    const plan = await planImport(m, 'Tags', (p) => v.read(p))
    const res = await applyImport(plan.items.map((item) => ({ item, choice })), f, v)
    return { plan, res }
  }

  it('imports everything into a fresh vault and stamps each note', async () => {
    const v = new FakeVault()
    const { plan, res } = await run(v)
    expect(plan.counts.new).toBe(2)
    expect(res.created).toBe(2)
    expect(v.files.get('Tags/core/tool/git.md')).toBe(stamp(a, sha256(a)))
  })

  it('a second run is all unchanged and writes nothing (R-IMP-10.1)', async () => {
    const v = new FakeVault()
    await run(v)
    v.writes = 0
    const { plan } = await run(v)
    expect(plan.counts.unchanged).toBe(2)
    expect(summarize(plan.counts)).toBe('Tags: up to date')
    expect(v.writes).toBe(0)
  })

  it('updates a note the user did not touch', async () => {
    const v = new FakeVault()
    await run(v)
    const a2 = note('tool/git', 'more')
    const m = mf([entry('core/tool/git.md', a2), entry('core/tool/github.md', b)])
    const { res } = await run(v, m, undefined, async (i) => (i.entry.path === 'core/tool/git.md' ? a2 : b))
    expect(res.updated).toBe(1)
    expect(stripStamp(v.files.get('Tags/core/tool/git.md')!)).toBe(a2)
  })

  it('never overwrites a conflict unless told; copies are named (glossary), (glossary 2) (R-IMP-5)', async () => {
    const v = new FakeVault()
    await run(v)
    const mine = v.files.get('Tags/core/tool/git.md')! + 'my edit\n'
    v.files.set('Tags/core/tool/git.md', mine)
    const a2 = note('tool/git', 'upstream change')
    const m = mf([entry('core/tool/git.md', a2), entry('core/tool/github.md', b)])
    const f = async (i: { entry: { path: string } }) => (i.entry.path === 'core/tool/git.md' ? a2 : b)
    v.writes = 0
    const { plan } = await run(v, m, undefined, f)
    expect(plan.counts.conflict).toBe(1)
    expect(summarize(plan.counts)).toBe('Tags: 1 conflict')
    expect(v.files.get('Tags/core/tool/git.md')).toBe(mine)
    expect(v.writes).toBe(0)

    await run(v, m, 'copy', f)
    await run(v, m, 'copy', f)
    expect(v.files.get('Tags/core/tool/git.md')).toBe(mine)
    expect(stripStamp(v.files.get('Tags/core/tool/git (glossary).md')!)).toBe(a2)
    expect(v.files.has('Tags/core/tool/git (glossary 2).md')).toBe(true)

    await run(v, m, 'theirs', f)
    expect(stripStamp(v.files.get('Tags/core/tool/git.md')!)).toBe(a2)
  })

  it('treats an existing unstamped note that differs as a conflict', async () => {
    const v = new FakeVault()
    v.files.set('Tags/core/tool/git.md', 'my own page')
    const { plan } = await run(v, undefined, 'keep')
    expect(plan.items[0].category).toBe('conflict')
    expect(v.files.get('Tags/core/tool/git.md')).toBe('my own page')
  })

  it('writes nothing when any fetch fails', async () => {
    const v = new FakeVault()
    const f = async (i: { entry: { path: string } }) => {
      if (i.entry.path.endsWith('github.md')) throw new Error('401')
      return a
    }
    await expect(run(v, undefined, undefined, f)).rejects.toThrow('401')
    expect(v.writes).toBe(0)
  })

  it('a hash mismatch on any note aborts with zero writes (R-IMP-6.1)', async () => {
    const v = new FakeVault()
    const f = async (i: { entry: { path: string } }) => (i.entry.path.endsWith('github.md') ? 'tampered' : a)
    await expect(run(v, undefined, undefined, f)).rejects.toThrow('manifest hash')
    expect(v.writes).toBe(0)
  })
})

describe('orphans (R-IMP-8.2)', () => {
  it('lists stamped notes the plan no longer contains, ignoring saved copies', () => {
    const planned = ['Tags/core/a.md']
    const stamped = ['Tags/core/a.md', 'Tags/core/b.md', 'Tags/core/a (glossary).md', 'Tags/core/a (glossary 2).md']
    expect(findOrphans(planned, stamped)).toEqual(['Tags/core/b.md'])
  })
  it('formats the summary suffix', () => {
    expect(orphanSuffix(0)).toBe('')
    expect(orphanSuffix(1)).toContain('1 imported note is')
    expect(orphanSuffix(3)).toContain('3 imported notes are')
  })
})
