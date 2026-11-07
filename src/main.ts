import { Plugin } from 'obsidian'
import { Host, importRegistry } from './host/controller'
import { makeLogger } from './host/logger'
import { normalizeSettings, RegistrySettings } from './settings'
import { RegistrySettingTab } from './ui/SettingTab'

export default class TagRegistryPlugin extends Plugin {
  settings!: RegistrySettings

  async onload() {
    this.settings = normalizeSettings(await this.loadData())
    makeLogger(this.settings).debug('loaded', { version: this.manifest.version, startupMode: this.settings.startupMode })
    this.addSettingTab(new RegistrySettingTab(this.app, this))
    this.addCommand({
      id: 'import-tags',
      name: 'Import / update tags',
      callback: () => void importRegistry(this.host(), { mode: 'interactive' }),
    })
    this.app.workspace.onLayoutReady(() => void this.startup())
  }

  /** The only view of the plugin that import and settings code receive. */
  host(): Host {
    return { app: this.app, settings: this.settings, saveSettings: () => this.saveData(this.settings) }
  }

  private async startup() {
    const mode = this.settings.startupMode
    const log = makeLogger(this.settings)
    if (mode === 'off') {
      log.debug('startup import disabled')
      return
    }
    try {
      await importRegistry(this.host(), { mode: mode === 'auto' ? 'auto' : 'notify' })
    } catch (e) {
      log.warn('startup import failed', e)
    }
  }
}
