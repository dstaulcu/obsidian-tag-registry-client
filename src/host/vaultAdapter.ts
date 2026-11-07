import { App, normalizePath, TFile } from 'obsidian'
import { ImportVault } from '../core/importer'
import { renameTagInText } from '../core/rename'
import { readStamp } from '../core/stamp'

export function vaultAdapter(app: App): ImportVault {
  const vault = app.vault
  return {
    read: async (path) => ((await vault.adapter.exists(normalizePath(path))) ? vault.adapter.read(normalizePath(path)) : null),
    create: async (path, content) => {
      const p = normalizePath(path)
      const parts = p.split('/').slice(0, -1)
      for (let i = 1; i <= parts.length; i++) {
        const d = parts.slice(0, i).join('/')
        if (!(await vault.adapter.exists(d))) await vault.createFolder(d)
      }
      await vault.create(p, content)
    },
    modify: async (path, content) => {
      const f = vault.getAbstractFileByPath(normalizePath(path))
      if (!(f instanceof TFile)) throw new Error(`${path} is not in the vault index yet; try again`)
      await vault.modify(f, content)
    },
    listStamped: async (dest) => {
      const prefix = normalizePath(dest) + '/'
      const out: string[] = []
      for (const f of vault.getMarkdownFiles()) {
        if (f.path.startsWith(prefix) && readStamp(await vault.cachedRead(f))) out.push(f.path)
      }
      return out
    },
  }
}

/** Markdown notes outside the destination folder that mention the tag. */
export async function usages(app: App, dest: string, tag: string): Promise<TFile[]> {
  const prefix = normalizePath(dest.trim()) + '/'
  const out: TFile[] = []
  for (const f of app.vault.getMarkdownFiles()) {
    if (f.path.startsWith(prefix)) continue
    const text = await app.vault.cachedRead(f)
    if (renameTagInText(text, tag, '\u0000') !== text) out.push(f)
  }
  return out
}

export async function renameUsages(app: App, dest: string, from: string, to: string): Promise<number> {
  let n = 0
  for (const f of await usages(app, dest, from)) {
    await app.vault.process(f, (t) => renameTagInText(t, from, to))
    n++
  }
  return n
}
