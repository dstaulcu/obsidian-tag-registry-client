import { App, getAllTags, normalizePath, parseFrontMatterAliases, TFile } from 'obsidian'
import { ImportVault } from '../core/importer'
import type { TagPageScan } from '../core/tagPages'
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

/**
 * Tags used by notes outside the `exclude` folders (note counts, lowercased), and every `#tag` alias in the vault,
 * which marks its note as that tag's page (R-TP-2). Reads Obsidian's metadata cache only; nothing is written.
 */
export async function scanTags(app: App, exclude: string[]): Promise<TagPageScan> {
  const prefixes = exclude.filter(Boolean).map((d) => normalizePath(d).toLowerCase() + '/')
  const used: Record<string, number> = {}
  const paged: string[] = []
  for (const f of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(f)
    if (!cache) continue
    for (const a of parseFrontMatterAliases(cache.frontmatter) ?? []) if (typeof a === 'string' && a.startsWith('#')) paged.push(a)
    if (prefixes.some((p) => f.path.toLowerCase().startsWith(p))) continue
    for (const t of new Set((getAllTags(cache) ?? []).map((x) => x.toLowerCase()))) used[t] = (used[t] ?? 0) + 1
  }
  return { used, paged }
}
