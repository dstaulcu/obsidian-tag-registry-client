import { renameTagInText } from '../src/core/rename'

describe('renameTagInText', () => {
  it('renames whole tags and children only', () => {
    const t = 'a #tools/git b #tools/gitlab c #tools/git/sub, #tools/git.\n'
    expect(renameTagInText(t, 'tools/git', 'tools/vcs')).toBe('a #tools/vcs b #tools/gitlab c #tools/vcs/sub, #tools/vcs.\n')
  })
  it('handles front-matter lists and skips code', () => {
    const t = '---\ntags:\n  - tools/git\n  - tools/gitlab\n---\n`#tools/git` #tools/git\n```\n#tools/git\n```\n'
    const want = '---\ntags:\n  - tools/vcs\n  - tools/gitlab\n---\n`#tools/git` #tools/vcs\n```\n#tools/git\n```\n'
    expect(renameTagInText(t, 'tools/git', 'tools/vcs')).toBe(want)
  })
})
