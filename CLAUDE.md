# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Tag Registry Client" (`tag-registry-client`): a non-AI, desktop-only Obsidian plugin extracted from the sibling repo `obsidian-scheduled-agents` (`src/glossary/*`). It subscribes to a shared tag-registry repo (core + chosen teams) and imports tags as one hash-stamped markdown note per tag, on demand or at startup.

The product specs are in `.kiro/`: `.kiro/README.md` (spec index, manifest v2 contract, open questions), `.kiro/steering/{product,tech,structure}.md`, and `.kiro/specs/<name>/{requirements,design,tasks}.md`. Requirement ids (`R-FND-n`, `R-SUB-n`, `R-IMP-n`) appear in code comments and test names; keep them stable. The `scheduler-extraction` spec edits the *other* repo and has no work here.

## Commands

- `npm test` — Jest (ts-jest, node env) over `tests/**/*.test.ts`. One file: `npx jest tests/plan.test.ts`; one test: `npx jest -t "<name>"`.
- `npm run type:check` — `tsc --noEmit`.
- `npm run build` — type-check, then production esbuild to `main.js` (cjs/es2020; externals `obsidian`, `electron`, Node builtins). `npm run dev` watches.
- `npm run deploy` — build and copy into the vault named by gitignored `.deploy.json` / `$OBSIDIAN_VAULT`.
- `npm run ship[:minor|:major]` — bump, PR, CI, merge, tag. Versions in `manifest.json`/`package.json`/`versions.json` change only via `scripts/release.mjs`. A bare-semver tag publishes the release.

## Architecture

- `src/core/` is **pure** (no `obsidian` import; `tests/purity.test.ts` enforces it). Environment-specific things (HTTP, git, fs, vault, secrets) are injected. Pipeline: `manifest` (parse/validate/merge/filter v2; file name `MANIFEST_FILE`) → `sources` (https | git | token fetch seam) → `plan` (diff vs local) → `apply` (fetch + hash-verify all, then write) with `stamp` (`glossary_hash`) and `rename` (opt-in in-text tag rename).
- `core/importer.ts` holds the whole import flow (`runImport`, `fetchTeams`) against an injected `ImportEnv`, so interactive/notify/auto behaviour is unit-tested with fakes (`tests/importer.test.ts`). `host/controller.ts` only builds the real `ImportEnv` from a `Host` `{app, settings, saveSettings}`; the plugin object is never passed down.
- `src/host/` adapters: `nodeDeps` (requestUrl / execFile / fs), `vaultAdapter`, `secrets` (takes an app-like `{secretStorage?}`, not the plugin). `src/ui/` has `SettingTab` and `PreviewModal` (`openAndWait()` resolves to the choices or null). `src/main.ts` is wiring only. `src/brand.ts` centralizes id/name/log tag/repo/default folder.
- Logging: `core/log.ts` is a pure `Logger` (`warn`/`error` always, `debug`/`info` only while the `debugLogging` setting is on) injected as `ImportEnv.log`; `host/logger.ts` is the console sink. Log scalars/counts only and name repos via `publicRepoUrl` (Invariant 5); `tests/importer.test.ts` has a sentinel test.
- `settings.ts` `normalizeSettings` is total and drops unknown keys; there is no migration from Scheduled Agents.

## Invariants (do not violate)

1. No vault writes before the user confirms the preview — except opt-in startup `auto`, which writes only new/updated notes (never conflicts or renames).
2. Every manifest note path passes `isSafeNotePath`; hidden folders are never written; the destination passes `destError`.
3. Downloaded note text must match its manifest sha256 before it is stamped/written.
4. Fetch and validate all sources before any write; one failure aborts the whole run ("No notes were changed").
5. Diagnostics, notices and logs never contain tokens, credentialed URLs, note content or vault paths. Use `publicRepoUrl` when naming a repo.
6. No import from, or runtime reference to, the Scheduled Agents plugin or any other plugin.

## Manifest v2 contract

Registry layout `glossary.json`, `core/<facet>/<name>.md`, `teams/<team>/<facet>/<name>.md`; kebab-case segments; `source`/`facet` derived from the path. Notes land at `<dest>/core/...` and `<dest>/<team>/...`. The stamp key `glossary_hash` is kept for compatibility with the registry tooling and notes imported by the old plugin. Changing the contract needs a version bump on both sides. Full shape in `.kiro/README.md`.

## Decisions taken where the specs left a choice

Defaults are `Tags` for the destination and `notify` for startup mode; orphans are reported in the summary only (never deleted); `auto` mode is kept as opt-in. The name/id, repo URL (`brand.ts`) and these defaults are the open questions in `.kiro/README.md`.
