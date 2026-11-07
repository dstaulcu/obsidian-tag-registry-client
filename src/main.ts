import { Plugin } from 'obsidian'
import { LOG_TAG } from './brand'
import { Host, importRegistry } from './host/controller'
import { normalizeSettings, RegistrySettings } from './settings'
import { RegistrySettingTab } from './ui/SettingTab'

export default class TagRegistryPlugin extends Plugin {
  settings!: RegistrySettings

  async onload() {
    this.settings = normalizeSettings(await this.loadData())
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
    if (mode === 'off') return
    try {
      await importRegistry(this.host(), { mode: mode === 'auto' ? 'auto' : 'notify' })
    } catch (e) {
      console.warn(`[${LOG_TAG}] startup import failed`, e)
    }
  }
}
