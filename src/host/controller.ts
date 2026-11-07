import { App, Notice } from 'obsidian'
import { fetchTeams, ImportEnv, ImportMode, runImport } from '../core/importer'
import { createSource } from '../core/sources'
import { RegistrySettings } from '../settings'
import { PreviewModal } from '../ui/PreviewModal'
import { makeLogger } from './logger'
import { nodeDeps } from './nodeDeps'
import { getToken } from './secrets'
import { renameUsages, usages, vaultAdapter } from './vaultAdapter'

/** What import and settings code may touch. The plugin object itself is never passed down. */
export interface Host {
  app: App
  settings: RegistrySettings
  saveSettings(): Promise<void>
}

function envFor(host: Host): ImportEnv {
  return {
    settings: host.settings,
    saveSettings: host.saveSettings,
    getToken: (src) => getToken(host.app, src),
    makeSource: (cfg) => createSource(cfg, nodeDeps(cfg)),
    vault: vaultAdapter(host.app),
    notice: (m, ms) => void new Notice(m, ms),
    preview: (plan) =>
      new PreviewModal(host.app, plan, async (tag) => (await usages(host.app, host.settings.destFolder, tag)).length).openAndWait(),
    countUsages: async (dest, tag) => (await usages(host.app, dest, tag)).length,
    renameUsages: (dest, from, to) => renameUsages(host.app, dest, from, to),
    log: makeLogger(host.settings),
  }
}

export function importRegistry(host: Host, opts: { mode: ImportMode }): Promise<void> {
  return runImport(envFor(host), opts)
}

export function fetchRegistryTeams(host: Host): Promise<string | null> {
  return fetchTeams(envFor(host))
}
