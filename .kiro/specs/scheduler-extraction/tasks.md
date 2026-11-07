# Tasks: Scheduler extraction (in `obsidian-scheduled-agents`)

- [ ] 0. Preconditions (R-EXT-6)
  - [ ] 0.1 Commit the pending `src/glossary/sources.ts` URL-in-error change (or confirm it is carried in the new repo's `core/sources.ts`).
  - [ ] 0.2 Tag Registry Client `0.1.0` released and installed in the author's vault.
- [ ] 1. Capture a fixture (R-EXT-3): copy a real schema-2 `data.json` (redact token) to `tests/fixtures/pre-split-data.json`; write a failing test that loads it and asserts no Tag Review job/state and no removed keys.
- [ ] 2. Delete Tag Review (R-EXT-1): `src/tagreview/`, `TAG_REVIEW_*`, BUILTINS entry, `LEGACY_IDS` entry, command registrations, `BrandVars` fields, `.ba-review*` CSS, `tagVocabularyPath`/`tagReview` settings, vocab handling in `main.ts`.
- [ ] 3. Delete importer (R-EXT-2): `src/glossary/`, `GlossaryPreviewModal`, settings types/normalisers, `ensureGlossary`, settings-tab section, diagnostics fields.
- [ ] 4. Make `normalizeSettings` tolerant and bump `SCHEMA_VERSION` (R-EXT-3); fixture test goes green.
- [ ] 5. `skipFolders()` cleanup and settings-tab text (R-EXT-4.3).
- [ ] 6. Tests: delete `tagreview.test.ts`, `glossary.test.ts`; trim `core.test.ts`, `diagnostics.test.ts`; `npm test` and `npm run build` green (R-EXT-4.4).
- [ ] 7. Docs and scripts (R-EXT-5): README, CLAUDE.md, DEMO.md, seed/reset scripts, manifest/package descriptions; link to Tag Registry Client.
- [ ] 8. `grep -ri "glossary\|tagreview\|tag review\|vocabulary\|brain-edits"` over the repo returns only the migration-tolerance code/tests and release notes.
- [ ] 9. Manual: deploy to throwaway vault restored from the pre-split `data.json`; app loads, Digest runs, no Tag Review command, settings tab clean.
- [ ] 10. `npm run ship:minor` (0.3.0) with release notes (R-EXT-5.3, Risks section).
