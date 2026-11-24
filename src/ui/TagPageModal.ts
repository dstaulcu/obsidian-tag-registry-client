import { App, Modal, Setting } from 'obsidian'
import { normalizeDest } from '../core/destination'
import { skippedSummary, TagPageItem, TagPagePlan } from '../core/tagPages'

/** Lists the tag pages "Create missing tag pages" would add. Nothing is written until Create (R-TP-3). */
export class TagPageModal extends Modal {
  private selected = new Set<string>()
  private settle: (r: TagPageItem[] | null) => void = () => undefined

  constructor(app: App, private plan: TagPagePlan, private folder: string) {
    super(app)
    for (const i of plan.create) this.selected.add(i.tag)
  }

  /** Resolves with the ticked items on Create, or null on Cancel/close. */
  openAndWait(): Promise<TagPageItem[] | null> {
    return new Promise((resolve) => {
      this.settle = resolve
      this.open()
    })
  }

  onOpen() {
    const { contentEl } = this
    this.titleEl.setText('Create tag pages')
    contentEl.empty()
    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: `These tags are used in your notes but have no page and no registry defines them. Each page goes in ${normalizeDest(this.folder)}/<facet>/ with the tag as an alias and an empty Definition line for you to fill in.`,
    })
    const skipped = skippedSummary(this.plan.skipped)
    if (skipped) contentEl.createEl('p', { cls: 'setting-item-description', text: `Skipped: ${skipped}.` })
    new Setting(contentEl).setName(`New pages (${this.plan.create.length})`).setHeading()
    for (const item of this.plan.create) {
      new Setting(contentEl)
        .setName(`#${item.tag}`)
        .setDesc(`Used in ${item.uses} note${item.uses === 1 ? '' : 's'}`)
        .addToggle((t) => t.setValue(true).onChange((v) => (v ? this.selected.add(item.tag) : this.selected.delete(item.tag))))
    }
    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) =>
        b.setButtonText('Create').setCta().onClick(() => {
          b.setDisabled(true)
          this.settle(this.plan.create.filter((i) => this.selected.has(i.tag)))
          this.close()
        }),
      )
  }

  onClose() {
    this.settle(null) // no-op if Create already resolved
    this.contentEl.empty()
  }
}
