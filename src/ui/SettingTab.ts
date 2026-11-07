import { apiVersion, App, Notice, PluginSettingTab, Setting } from 'obsidian'
import { REPO_URL } from '../brand'
import { buildReport, snapshotFromSettings } from '../core/diagnostics'
import { destError } from '../core/destination'
import { gitAvailable, parseRepoUrl, REPO_URL_HINT } from '../core/sources'
import { fetchRegistryTeams, importRegistry } from '../host/controller'
import { nodeDeps } from '../host/nodeDeps'
import { clearToken, getToken, hasSecretStorage, setToken } from '../host/secrets'
import type TagRegistryPlugin from '../main'
import { newSource, StartupMode } from '../settings'

export class RegistrySettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TagRegistryPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    this.renderRegistries(containerEl)
    this.renderTeams(containerEl)
    this.renderDestination(containerEl)
    this.renderWhen(containerEl)
    this.renderReport(containerEl)
  }

  private save = () => this.plugin.saveData(this.plugin.settings)

  private renderRegistries(el: HTMLElement) {
    const p = this.plugin
    const s = p.settings
    new Setting(el).setName('Registries').setHeading()
    el.createEl('p', {
      cls: 'setting-item-description',
      text: 'Tag registries are merged; earlier ones win on a duplicate tag. Core tags are always imported. Read-only: nothing is pushed.',
    })
    s.sources.forEach((src, i) => {
      const hint = el.createEl('div', { cls: 'setting-item-description trs-invalid' })
      const check = () => hint.setText(src.repoUrl.trim() && !parseRepoUrl(src.repoUrl) ? REPO_URL_HINT : '')
      new Setting(el)
        .setName(`Registry ${i + 1} URL`)
        .setDesc(i === 0 ? 'HTTPS URL of a tag registry repo, e.g. https://github.com/owner/tag-registry.' : 'Another registry in the same format.')
        .addText((t) =>
          t.setValue(src.repoUrl).onChange(async (v) => {
            src.repoUrl = v.trim()
            check()
            await this.save()
          }),
        )
        .addExtraButton((b) =>
          b.setIcon('arrow-up').setTooltip('Higher precedence').setDisabled(i === 0).onClick(async () => this.move(i, -1)),
        )
        .addExtraButton((b) =>
          b.setIcon('arrow-down').setTooltip('Lower precedence').setDisabled(i === s.sources.length - 1).onClick(async () => this.move(i, 1)),
        )
        .addExtraButton((b) =>
          b.setIcon('trash').setTooltip('Remove').onClick(async () => {
            clearToken(this.app, src)
            s.sources.splice(i, 1)
            if (!s.sources.length) s.sources.push(newSource())
            await this.save()
            this.display()
          }),
        )
      check()
      new Setting(el)
        .setName('Branch or tag')
        .addText((t) =>
          t.setPlaceholder('main').setValue(src.ref).onChange(async (v) => {
            src.ref = v.trim() || 'main'
            await this.save()
          }),
        )
        .addDropdown((d) =>
          d
            .addOptions({ https: 'Anonymous HTTPS', git: 'Local git', token: 'Access token' })
            .setValue(src.authMethod)
            .onChange(async (v) => {
              src.authMethod = v as typeof src.authMethod
              await this.save()
              this.display()
            }),
        )
      if (src.authMethod === 'git') {
        const note = el.createEl('div', { cls: 'setting-item-description' })
        note.setText('Uses your own git credentials. Checking for git…')
        void gitAvailable(nodeDeps({ repoUrl: '', ref: '', method: 'git' })).then((ok) => {
          note.setText(ok ? 'git found. Uses your own git credentials.' : 'git was not found on PATH. Install git or choose another method.')
          if (!ok) note.addClass('trs-invalid')
        })
      }
      if (src.authMethod === 'token') {
        const secure = hasSecretStorage(this.app)
        new Setting(el)
          .setName('Access token')
          .setDesc(
            secure
              ? 'Read-only scope only. Kept in Obsidian secret storage.'
              : 'Read-only scope only. This Obsidian version has no secret storage, so the token is saved as plain text in the plugin data.json. Exclude that file from sync.',
          )
          .addText((t) => {
            t.inputEl.type = 'password'
            t.setValue(getToken(this.app, src)).onChange(async (v) => {
              setToken(this.app, src, v.trim())
              await this.save()
            })
          })
        if (!secure) el.createEl('div', { cls: 'setting-item-description trs-warning', text: 'Warning: the token will be stored as plain text.' })
      }
    })
    new Setting(el).addButton((b) =>
      b.setButtonText('Add registry').onClick(async () => {
        s.sources.push(newSource())
        await this.save()
        this.display()
      }),
    )
  }

  private async move(i: number, by: number) {
    const list = this.plugin.settings.sources
    ;[list[i], list[i + by]] = [list[i + by], list[i]]
    await this.save()
    this.display()
  }

  private renderTeams(el: HTMLElement) {
    const p = this.plugin
    const s = p.settings
    new Setting(el).setName('Teams').setHeading()
    new Setting(el)
      .setName('Fetch teams')
      .setDesc('Reads the registries and lists their teams.')
      .addButton((b) =>
        b.setButtonText('Fetch teams').onClick(async () => {
          const err = await fetchRegistryTeams(p.host())
          if (err) new Notice(`${err}. Your selection was not changed.`, 8000)
          this.display()
        }),
      )
    new Setting(el)
      .setName('All teams')
      .setDesc('Import every team in the registries. Your individual ticks are kept for when this is off.')
      .addToggle((t) =>
        t.setValue(s.allTeams).onChange(async (v) => {
          s.allTeams = v
          await this.save()
          this.display()
        }),
      )
    new Setting(el)
      .setName('Show example teams')
      .setDesc('Placeholder teams the registry marks as examples. Hidden by default.')
      .addToggle((t) =>
        t.setValue(s.showExampleTeams).onChange(async (v) => {
          s.showExampleTeams = v
          await this.save()
          this.display()
        }),
      )
    new Setting(el)
      .setName('Include parent teams')
      .setDesc("A team also sees its parents' tags. Ticking a team also ticks its parents.")
      .addToggle((t) =>
        t.setValue(s.includeAncestors).onChange(async (v) => {
          s.includeAncestors = v
          await this.save()
        }),
      )
    if (s.allTeams) return
    if (!s.knownTeams.length) {
      el.createEl('p', { cls: 'setting-item-description', text: 'No teams known yet. Press "Fetch teams" or run "Import / update tags".' })
    }
    const parentOf = (id: string) => s.knownTeams.find((k) => k.id === id)?.parent ?? null
    const toggle = (id: string) => async (v: boolean) => {
      if (v) {
        const add = [id]
        if (s.includeAncestors) for (let p = parentOf(id); p; p = parentOf(p)) add.push(p)
        s.teams = [...new Set([...s.teams, ...add])]
      } else s.teams = s.teams.filter((x) => x !== id)
      await this.save()
      if (v && s.includeAncestors) this.display()
    }
    const depth = (id: string) => {
      let n = 0
      for (let p = parentOf(id); p && n < 20; p = parentOf(p)) n++
      return n
    }
    const visible = s.knownTeams.filter((t) => s.showExampleTeams || !t.example || s.teams.includes(t.id))
    // parents before children, siblings in manifest order
    const ordered: typeof visible = []
    const place = (parent: string | null) => {
      for (const t of visible.filter((x) => (x.parent && visible.some((v) => v.id === x.parent) ? x.parent : null) === parent)) {
        ordered.push(t)
        place(t.id)
      }
    }
    place(null)
    for (const team of ordered) {
      const row = new Setting(el).setName(team.name).setDesc([team.level, team.description].filter(Boolean).join(' · ')).addToggle((t) => t.setValue(s.teams.includes(team.id)).onChange(toggle(team.id)))
      row.settingEl.style.paddingLeft = `${depth(team.id) * 16}px`
      if (team.example) row.nameEl.createSpan({ cls: 'trs-badge', text: 'example' })
    }
    if (s.knownTeams.length) {
      for (const id of s.teams.filter((t) => !s.knownTeams.some((k) => k.id === t))) {
        const row = new Setting(el).setDesc('Selected, but no registry lists this team. Local notes are kept.')
        row.nameEl.setText(id)
        row.nameEl.createSpan({ cls: 'trs-badge', text: 'not found upstream' })
        row.addToggle((t) => t.setValue(true).onChange(toggle(id)))
      }
    }
  }

  private renderDestination(el: HTMLElement) {
    const p = this.plugin
    const s = p.settings
    new Setting(el).setName('Destination').setHeading()
    const msg = el.createEl('div', { cls: 'setting-item-description trs-invalid' })
    const validate = () => msg.setText(destError(s.destFolder) ?? '')
    new Setting(el)
      .setName('Destination folder')
      .setDesc('Vault folder tags are imported into: <folder>/core/... and <folder>/<team>/...')
      .addText((t) => {
        const listId = 'trs-folders'
        const list = el.createEl('datalist', { attr: { id: listId } })
        for (const f of this.app.vault.getAllFolders(false)) if (f.path !== '/') list.createEl('option', { value: f.path })
        t.inputEl.setAttr('list', listId)
        t.setValue(s.destFolder).onChange(async (v) => {
          s.destFolder = v.trim()
          validate()
          // an invalid folder is shown but never used: imports refuse it
          await this.save()
        })
      })
    validate()
  }

  private renderWhen(el: HTMLElement) {
    const p = this.plugin
    const s = p.settings
    new Setting(el).setName('When to import').setHeading()
    new Setting(el)
      .setName('At startup')
      .setDesc('Notify: shows a notice when there are changes and never writes. Auto: also adds new and updated tags without asking; conflicts and renames are left for you.')
      .addDropdown((d) =>
        d
          .addOptions({ off: 'Off', notify: 'Notify', auto: 'Auto-import' })
          .setValue(s.startupMode)
          .onChange(async (v) => {
            s.startupMode = v as StartupMode
            await this.save()
          }),
      )
    new Setting(el)
      .setName('Import / update')
      .setDesc('Fetches the registries and shows a preview. Nothing is written until you apply it. Also refreshes the team list.')
      .addButton((b) =>
        b.setButtonText('Import / update tags').setCta().onClick(async () => {
          await importRegistry(p.host(), { mode: 'interactive' })
          this.display()
        }),
      )
  }

  private renderReport(el: HTMLElement) {
    const p = this.plugin
    new Setting(el).setName('Report an issue').setHeading()
    const report = () =>
      buildReport(
        snapshotFromSettings(p.settings, {
          pluginVersion: p.manifest.version,
          obsidianVersion: apiVersion,
          platform: process.platform,
          arch: process.arch,
          secretStorage: hasSecretStorage(this.app),
        }),
      )
    new Setting(el)
      .setName('Diagnostics')
      .setDesc('Versions and counts to paste into a bug report. It never includes tokens, repo URLs, team names, folders, note content or vault paths.')
      .addButton((b) =>
        b.setButtonText('Copy').onClick(async () => {
          await navigator.clipboard.writeText(report())
          new Notice('Diagnostics copied')
        }),
      )
      .addButton((b) =>
        b.setButtonText('Report a bug').setCta().onClick(() => {
          window.open(`${REPO_URL}/issues/new?template=bug_report.yml&plugin_version=${encodeURIComponent(p.manifest.version)}`)
        }),
      )
  }
}
