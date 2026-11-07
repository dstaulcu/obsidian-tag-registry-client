import { RegistryVault } from '../src/core/apply'
import { Manifest } from '../src/core/manifest'
import { sha256 } from '../src/core/stamp'

export const note = (tag: string, extra = '') => `---\ntag: ${tag}\nstatus: active\n---\n\n# ${tag}\n${extra}\n`

export const entry = (path: string, text: string, over: Record<string, unknown> = {}) => {
  const parts = path.split('/')
  return {
    tag: parts.slice(-2).join('/').replace(/.md$/, ''),
    facet: parts[parts.length - 2],
    source: parts[0] === 'core' ? 'core' : parts[1],
    status: 'active' as 'active' | 'proposed' | 'deprecated',
    replaced_by: null as string | null,
    aliases: [] as string[],
    definition: '',
    path,
    hash: sha256(text),
    ...over,
  }
}

export const team = (id: string, over: Partial<Manifest['teams'][number]> = {}): Manifest['teams'][number] => ({ id, name: id, description: '', level: '', parent: null, example: false, ...over })

export const mf = (tags: ReturnType<typeof entry>[], teams: Manifest['teams'] = []): Manifest => ({
  version: 2,
  facets: ['project', 'community', 'tactic', 'tool'],
  teams,
  tags,
})

export class FakeVault implements RegistryVault {
  files = new Map<string, string>()
  writes = 0
  async read(p: string) {
    return this.files.get(p) ?? null
  }
  async create(p: string, c: string) {
    this.writes++
    this.files.set(p, c)
  }
  async modify(p: string, c: string) {
    this.writes++
    this.files.set(p, c)
  }
}
