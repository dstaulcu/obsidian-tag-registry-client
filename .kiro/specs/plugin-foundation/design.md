# Design: Plugin foundation

## Repository bootstrap
Start from the Scheduled Agents repo's tooling, not its source:

| Copy as-is (adjust names) | Notes |
|---|---|
| `esbuild.config.mjs`, `tsconfig.json`, `jest.config.js`, `.gitignore`, `.editorconfig`/lint config | entry stays `src/main.ts` |
| `scripts/release.mjs`, `ship.mjs`, `tag-release.mjs`, `deploy.mjs` | manifest-driven; replace hard-coded plugin dir `scheduled-agents` with `tag-registry-client` |
| `.github/workflows/ci.yml`, `release.yml` | update install-note text |
| `.github/ISSUE_TEMPLATE/*`, `CODEOWNERS` | rewrite wording |
| `CONTRIBUTING.md` | remove test-vault Tag Review bits |

Do **not** copy: `src/executors`, `core/runner|schedule|pass|templates|dailyNotes`, `reset-test.mjs`/`seed-demo.mjs` (scheduler-specific; a small `reset:test` for the new plugin is optional later), `claude-issue-fix.yml` (decide separately).

## Files
`manifest.json`
```json
{ "id": "tag-registry-client", "name": "Tag Registry Client", "version": "0.1.0", "minAppVersion": "1.4.0",
  "description": "Subscribe to a shared tag-registry repo and import its core and team tags into your vault as notes.",
  "author": "David Staulcup", "isDesktopOnly": true }
```
`src/brand.ts`: `PLUGIN_ID`, `PLUGIN_NAME`, `LOG_TAG = 'tag-registry-client'`, `REPO_URL`, `DEFAULT_DEST_FOLDER = 'Tags'`.

`styles.css`: only classes used by settings tab/modal (prefix `.trs-`). Nothing from `.ba-*`.

## main.ts sketch
```ts
export default class TagRegistryPlugin extends Plugin {
  settings!: RegistrySettings
  async onload() {
    this.settings = normalizeSettings(await this.loadData())
    this.addSettingTab(new RegistrySettingTab(this.app, this))
    this.addCommand({ id: 'import-tags', name: 'Import / update tags', callback: () => importRegistry(this.host(), { mode: 'interactive' }) })
    this.app.workspace.onLayoutReady(() => this.startup())
  }
  host(): Host { return { app: this.app, settings: this.settings, saveSettings: () => this.saveData(this.settings) } }
}
```
The plugin object is never passed into core or host code; only `Host` (see registry-import).

## Purity guard
A Jest test greps `src/core/**/*.ts` for `from 'obsidian'` / `require('obsidian')` and fails if found (R-FND-2.3).

## Diagnostics
`core/diagnostics.ts` exports `buildReport(snapshot)` where `snapshot` has only the scalar/count fields listed in R-FND-5. `tests/diagnostics.test.ts` builds a snapshot from a settings object with sentinel strings in every sensitive field and asserts none appear in output (same technique as the scheduler repo).

## Versioning
Start at `0.1.0`. `versions.json` maps plugin version → `minAppVersion`. Release flow identical to the scheduler repo: `npm run ship` (bump, PR, CI, merge, tag).

## Community directory
Out of scope for the first release; `README` and manifest are written to satisfy the submission checklist so it can follow.
