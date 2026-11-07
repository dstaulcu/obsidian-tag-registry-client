import { createSource, parseRepoUrl, publicRepoUrl, rawUrl, SourceDeps } from '../src/core/sources'

const deps = (over: Partial<SourceDeps> = {}): SourceDeps => ({
  httpGet: async () => ({ status: 200, text: 'x' }),
  run: async () => ({ stdout: '' }),
  readFile: async () => 'file',
  exists: async () => false,
  platform: 'win32',
  cacheDir: '/cache',
  ...over,
})
const cfg = (method: 'https' | 'git' | 'token', extra = {}) => ({ repoUrl: 'https://github.com/o/r', ref: 'main', method, ...extra })

describe('urls', () => {
  it('derives raw URLs for GitHub and GitLab', () => {
    expect(rawUrl(parseRepoUrl('https://github.com/o/r.git')!, 'main', 'registry.json')).toBe('https://raw.githubusercontent.com/o/r/main/registry.json')
    expect(rawUrl(parseRepoUrl('https://gitlab.corp/g/sub/r')!, 'v1', 'core/tool/git.md')).toBe('https://gitlab.corp/g/sub/r/-/raw/v1/core/tool/git.md')
  })
  it('rejects non-https and malformed repo URLs (R-SUB-1.2)', () => {
    for (const u of ['git@github.com:o/r.git', 'http://github.com/o/r', 'https://github.com/o', 'https://github.com/o/../r', '']) expect(parseRepoUrl(u)).toBeNull()
  })
  it('publicRepoUrl drops credentials and query strings', () => {
    expect(publicRepoUrl('https://alice:ghp_SECRET@github.com/o/r.git?token=ghp_SECRET')).toBe('https://github.com/o/r.git')
    expect(publicRepoUrl('nope')).toBe('invalid URL')
    expect(publicRepoUrl('  ')).toBe('not set')
  })
})

describe('sources', () => {
  it('names the method, status class and request URL on failure (R-SUB-3.4)', async () => {
    const s = createSource(cfg('https'), deps({ httpGet: async () => ({ status: 404, text: '' }) }))
    await expect(s.fetchManifest()).rejects.toThrow(/Registry \(https\).*404.*\[https:\/\/raw\.githubusercontent\.com\/o\/r\/main\/registry.json\]/)
    const t = createSource(cfg('token', { token: 't' }), deps({ httpGet: async () => ({ status: 401, text: '' }) }))
    await expect(t.fetchManifest()).rejects.toThrow(/Registry \(token\).*401/)
  })

  it('token method with no token fails before any request (R-SUB-3.3)', async () => {
    const httpGet = jest.fn()
    const s = createSource(cfg('token'), deps({ httpGet }))
    await expect(s.fetchManifest()).rejects.toThrow('no token configured')
    expect(httpGet).not.toHaveBeenCalled()
  })

  it('uses the GitHub contents API or GitLab files API with the right header', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = []
    const httpGet = async (url: string, headers: Record<string, string>) => (seen.push({ url, headers }), { status: 200, text: '{}' })
    await createSource(cfg('token', { token: 'T' }), deps({ httpGet })).fetchManifest()
    await createSource({ repoUrl: 'https://gl.corp/g/r', ref: 'dev', method: 'token', token: 'T' }, deps({ httpGet })).fetchNote('core/tool/git.md')
    expect(seen[0].url).toBe('https://api.github.com/repos/o/r/contents/registry.json?ref=main')
    expect(seen[0].headers).toMatchObject({ Authorization: 'Bearer T' })
    expect(seen[1].url).toContain('https://gl.corp/api/v4/projects/g%2Fr/repository/files/core%2Ftool%2Fgit.md/raw?ref=dev')
    expect(seen[1].headers).toEqual({ 'PRIVATE-TOKEN': 'T' })
  })

  it('the token never appears in a URL or in any error string (R-IMP-10.2)', async () => {
    const urls: string[] = []
    const cases: Array<Partial<SourceDeps>> = [
      { httpGet: async (u) => (urls.push(u), { status: 500, text: '' }) },
      { httpGet: async (u) => (urls.push(u), { status: 404, text: '' }) },
      { httpGet: async (u) => (urls.push(u), Promise.reject(new Error('socket hang up'))) },
    ]
    for (const over of cases) {
      const err = await createSource(cfg('token', { token: 'SECRET' }), deps(over)).fetchManifest().catch((e: Error) => e)
      expect((err as Error).message).not.toContain('SECRET')
    }
    expect(urls.join()).not.toContain('SECRET')
  })

  it('probes git with where on Windows and which elsewhere, and reports it missing (R-SUB-3.2)', async () => {
    const calls: string[] = []
    const run = async (file: string): Promise<{ stdout: string }> => {
      calls.push(file)
      throw Object.assign(new Error('nope'), { code: 'ENOENT' })
    }
    for (const platform of ['win32', 'linux']) {
      const s = createSource(cfg('git'), deps({ run, platform }))
      await expect(s.fetchManifest()).rejects.toThrow(/Registry \(git\).*git was not found.*another method/)
    }
    expect(calls).toEqual(['where', 'which'])
  })

  it('clones then reads from the cache, and rejects unsafe paths', async () => {
    const runs: string[][] = []
    const run = async (f: string, a: string[]) => (runs.push([f, ...a]), { stdout: '' })
    const s = createSource({ ...cfg('git'), ref: 'v1' }, deps({ run }))
    expect(await s.fetchManifest()).toBe('file')
    expect(runs[1]).toEqual(['git', '-c', 'core.autocrlf=false', 'clone', '--depth', '1', '--branch', 'v1', 'https://github.com/o/r', '/cache'])
    await expect(s.fetchNote('../secret.md')).rejects.toThrow('unsafe')
  })

  it('strips credentials from git stderr', async () => {
    const run = async (f: string) => {
      if (f === 'git') throw Object.assign(new Error('x'), { stderr: "fatal: unable to access 'https://bob:pw@host/o/r/'" })
      return { stdout: '' }
    }
    const err = await createSource(cfg('git'), deps({ run })).fetchManifest().catch((e: Error) => e)
    expect((err as Error).message).not.toContain('bob:pw')
  })
})
