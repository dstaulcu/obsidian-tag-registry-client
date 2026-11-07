# Requirements: Scheduler extraction

## Introduction
Work performed in the **existing `obsidian-scheduled-agents` repo** after (or alongside) the new plugin exists. The scheduler keeps only generic scheduled-agent behaviour plus the built-in Daily Notes Digest. Tag Review and the tag-registry importer leave the product. There is no migration of user data.

## Requirements

### R-EXT-1 Remove Tag Review
1. THE SYSTEM SHALL contain no Tag Review code: `src/tagreview/*`, the `brain-edits` code-block processor, `undo-tag-review` command, `registerTagReview`, vocabulary scaffold/bootstrap, `TAG_REVIEW_*` constants and prompt.
2. THE SYSTEM SHALL no longer register a `default/tag-review` built-in, nor the `run-builtin-tag-review` command; `run-builtins` SHALL run only remaining built-ins.
3. THE SYSTEM SHALL remove `tagVocabularyPath`, `tagReview` settings, the "Tag vocabulary note" field, and vocab re-basing in `renamePluginFolder`.
4. THE SYSTEM SHALL remove `vocabularyPath` and `bootstrap` from `BrandVars` and their defaults, and SHALL treat `{{vocabularyPath}}`/`{{bootstrap}}` as ordinary unknown variables in user prompts.
5. THE SYSTEM SHALL remove `.ba-review*`, `.ba-del`, `.ba-ins` styles.

### R-EXT-2 Remove the registry importer
1. THE SYSTEM SHALL delete `src/glossary/*`, `src/ui/GlossaryPreviewModal.ts`, the `import-glossary` command, the startup glossary check (`ensureGlossary`, `checkOnStartup`), and the settings-tab glossary section.
2. THE SYSTEM SHALL remove `GlossarySettings`, `GlossarySourceSetting`, `newGlossarySource`, `normalizeGlossary` and the `glossary` settings key.
3. THE SYSTEM SHALL remove glossary fields from diagnostics (`glossarySources`, `glossaryTeams`) and update `tests/diagnostics.test.ts`.
4. THE SYSTEM SHALL no longer reference `scheduled-agents-glossary-*` secret ids or cache dirs.

### R-EXT-3 Tolerate existing data
1. WHEN `data.json` contains `tagVocabularyPath`, `tagReview`, `glossary`, or a job with id/builtin `default/tag-review`, THE SYSTEM SHALL load without error.
2. THE SYSTEM SHALL drop the `default/tag-review` job and its `state` entry on load and SHALL NOT re-add it (built-in seeding no longer knows it).
3. THE SYSTEM SHALL drop the removed settings keys on the next save.
4. THE SYSTEM SHALL NOT delete or modify any existing vault notes (old `Tag Review.md` pages and imported glossary notes stay as plain files).
5. `LEGACY_IDS` entries pointing at Tag Review SHALL be removed.

### R-EXT-4 Remaining product still works
1. Daily Notes Digest SHALL still be seeded, runnable, resettable, and disabled-not-deleted per the existing invariants.
2. Custom jobs, scheduling, missed-run catch-up, executors, `{{lastRun}}`, allowed-output-folders and the read-only invariant SHALL be unchanged.
3. `protectedFolders`/`skipFolders()` SHALL no longer add a vocabulary parent folder; `plugin folder` and `.obsidian` stay protected.
4. All remaining tests SHALL pass; `npm run build` SHALL succeed.

### R-EXT-5 Rebrand and docs
1. `manifest.json` description and `package.json` description SHALL no longer mention Tag Review or tag edits.
2. README, CLAUDE.md, `docs/DEMO.md`, `scripts/seed-demo.mjs`, `scripts/reset-test.mjs` SHALL drop Tag Review/glossary references; README SHALL link to Tag Registry Client for tag import.
3. Version SHALL bump (minor, `0.3.0`) with a release note stating Tag Review and tag import were removed and where tag import went.

### R-EXT-6 Ordering and safety
1. THE SYSTEM SHALL not remove the importer from the scheduler repo before Tag Registry Client `0.1.0` has been released and installed in the author's vault (so tag import is never unavailable to the author).
2. The uncommitted `src/glossary/sources.ts` change (URL appended to HTTP errors) SHALL be committed or carried into the new repo first, so it is not lost.
