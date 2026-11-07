import * as fs from 'fs'
import * as path from 'path'

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}

const root = path.join(__dirname, '..', 'src')

describe('architecture guards', () => {
  it('src/core never imports obsidian (R-FND-2.3)', () => {
    const files = walk(path.join(root, 'core')).filter((f) => f.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8')
      expect({ f, hit: /from\s+['"]obsidian['"]|require\(\s*['"]obsidian['"]\s*\)|import\(\s*['"]obsidian['"]\s*\)/.test(text) }).toEqual({ f, hit: false })
    }
  })

  it('no source file touches other plugins or the Scheduled Agents plugin (R-FND-3.3, invariant 6)', () => {
    for (const f of walk(root).filter((x) => x.endsWith('.ts'))) {
      const text = fs.readFileSync(f, 'utf8')
      expect({ f, hit: /app\.plugins|scheduled-agents|scheduled agents/i.test(text) }).toEqual({ f, hit: false })
    }
  })

  it('manifest.json, package.json and versions.json agree (R-FND-1.3)', () => {
    const read = (n: string) => JSON.parse(fs.readFileSync(path.join(root, '..', n), 'utf8'))
    const m = read('manifest.json')
    expect(read('package.json').version).toBe(m.version)
    expect(read('versions.json')[m.version]).toBe(m.minAppVersion)
    expect(m).toMatchObject({ id: 'tag-registry-client', name: 'Tag Registry Client', isDesktopOnly: true, minAppVersion: '1.4.0' })
  })
})
