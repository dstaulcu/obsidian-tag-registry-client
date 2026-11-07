# Requirements: Plugin foundation

## Introduction
Everything needed to make the new plugin a buildable, testable, releasable Obsidian community plugin, independent of the Scheduled Agents repo.

## Requirements

### R-FND-1 Identity
1. THE SYSTEM SHALL use plugin id `tag-registry-client`, name "Tag Registry Client", `isDesktopOnly: true`, `minAppVersion: 1.4.0`, MIT license.
2. THE SYSTEM SHALL describe itself as syncing tags from a shared tag-registry repo, with no mention of AI or agents.
3. THE SYSTEM SHALL keep `manifest.json`, `package.json` and `versions.json` versions identical, changed only by the release script.
*(Id and name are assumptions pending README Q1; they are centralised in `src/brand.ts` and `manifest.json`.)*

### R-FND-2 Build and test
1. `npm test` SHALL run Jest (ts-jest, node env) over `tests/**/*.test.ts` with no Obsidian runtime.
2. `npm run build` SHALL type-check then produce a production `main.js`; `npm run dev` SHALL watch.
3. `src/core/**` SHALL NOT import `obsidian`; a test or lint rule SHALL fail the build if it does.
4. `main.js` SHALL be gitignored.

### R-FND-3 Entry point
1. WHEN loaded, THE SYSTEM SHALL load and normalise settings, register the settings tab and the "Import / update tags" command, and schedule the startup action per `startupMode`.
2. WHEN unloaded, THE SYSTEM SHALL leave no timers or listeners behind.
3. THE SYSTEM SHALL NOT access `app.plugins` or any other plugin.

### R-FND-4 Settings persistence
1. THE SYSTEM SHALL persist settings via `loadData/saveData` with `schemaVersion: 1`.
2. THE SYSTEM SHALL ignore unrecognised keys (including leftovers from other plugins' formats) without error.

### R-FND-5 Diagnostics
1. THE SYSTEM SHALL provide a "Report an issue" action that copies a plain-text report: plugin version, Obsidian version, platform, source count, access methods in use, selected-team count, startup mode, secret-storage availability.
2. THE SYSTEM SHALL NOT include tokens, repo URLs, team names, destination path, note content or vault paths. A unit test SHALL assert this against a snapshot containing sentinel values.
3. THE SYSTEM SHALL provide GitHub issue templates (bug, feature).

### R-FND-6 CI and release
1. CI SHALL run `npm ci`, `npm test`, `npm run build` on pull requests and pushes to `main`.
2. A bare semver tag SHALL trigger a release workflow that verifies the tag equals `manifest.json` version and publishes `main.js`, `manifest.json`, `styles.css`.
3. THE SYSTEM SHALL provide `release`, `bump`, `deploy`, `ship`, `tag` scripts equivalent to the Scheduled Agents repo, with the plugin folder name `tag-registry-client`.
4. `deploy` SHALL read the target vault from gitignored `.deploy.json`.

### R-FND-7 Docs
1. README SHALL cover: what it is, requirements (desktop; git only for the git method), install, registry setup (URL/ref/method/token), team subscription, import modes, conflict behaviour, folder layout, privacy (what is fetched, where tokens live), reporting a bug.
2. CLAUDE.md SHALL mirror the structure and invariants in `.kiro/steering/structure.md`.
3. CONTRIBUTING.md SHALL describe PR flow and releases.
