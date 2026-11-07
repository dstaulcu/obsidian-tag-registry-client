# Design: Scheduler extraction

## Approach
One PR in the scheduler repo, after the new plugin ships. Deletions first, then fix every compile error, then tests and docs. Because the tag features connect to the scheduler through only a few seams (identified by code survey), the change is mostly deletion.

## Change map
| Area | Action |
|---|---|
| `src/tagreview/*` | delete |
| `src/glossary/*`, `src/ui/GlossaryPreviewModal.ts` | delete (copy lives in new repo) |
| `src/core/builtinJobs.ts` | remove `TAG_REVIEW_NAME/ID/PROMPT` and its `BUILTINS` entry (≈ lines 4–54, 103–116); drop Tag Review from `LEGACY_IDS`; `ensureBuiltins` unchanged otherwise |
| `src/core/runner.ts` | `BrandVars`: remove `vocabularyPath`, `bootstrap` (≈ 182–199) |
| `src/settings.ts` | remove glossary/tag types, defaults, normalisers (≈ 4–37, 55–58, 78–80, 109–111, 117–144); bump `SCHEMA_VERSION` to 3; normaliser ignores removed keys |
| `src/main.ts` | remove imports (≈ 14, 17, 18), commands (≈ 63–74), `ensureGlossary`, `vocabularyBootstrap`, vocab re-base in `renamePluginFolder` (≈ 111), vocab parent in `skipFolders()` (≈ 173–178), brand vars (≈ 195–201), diagnostics args (≈ 246–247); drop Tag Review from the `run-builtin-*` loop output |
| `src/ui/SettingTab.ts` | remove `renderGlossary` (≈ 230–330), vocab field (≈ 218), glossary imports (≈ 10, 12); reword the protected-folders description (≈ 193) |
| `src/core/diagnostics.ts` + test | remove glossary fields |
| `styles.css` | remove `.ba-review*`, `.ba-del`, `.ba-ins` |
| tests | delete `tagreview.test.ts`, `glossary.test.ts`; trim `core.test.ts` (scaffold, vocab, normalizeSettings glossary cases) |
| docs/scripts | README (lines about Tag Review ≈ 3, 9, 20–21; "Tag registry import" section ≈ 77+), CLAUDE.md (architecture bullets for `tagreview/` and `glossary/`, brand-vars sentence), `docs/DEMO.md`, `scripts/seed-demo.mjs`, `scripts/reset-test.mjs`, `manifest.json`/`package.json` descriptions |

Line numbers are from the survey of the `multi-team-registry` branch and must be re-checked at execution time.

## Load-time tolerance (R-EXT-3)
`normalizeSettings(raw)`:
1. Build settings from known keys only (so removed keys vanish on next save).
2. `jobs = jobs.filter(j => j.builtin !== 'default/tag-review' && j.id !== 'default/tag-review')`; and `delete state['default/tag-review']`.
3. `ensureBuiltins` seeds from the remaining `BUILTINS` only. Legacy name-adoption must not recreate Tag Review (the user job named "Tag Review" with a *different* id, if any, stays as a normal custom job).

Test with a fixture `data.json` from a real pre-split install (schema 2, includes enabled Tag Review job with edited prompt, state, glossary sources with a plaintext token).

## Secrets left behind
Old `scheduled-agents-glossary-token-*` entries remain in Obsidian secret storage. The plugin cannot enumerate them, so the release note tells users they may delete them. No code attempts cleanup.

## Sequencing
1. New repo reaches `0.1.0` (plugin-foundation + subscription + import tasks done).
2. Install in author's vault; verify existing `Glossary/` notes show as `unchanged` (only if the destination folder is set to `Glossary`).
3. Open the extraction PR; `npm run ship:minor`.

## Risks
- A user who keeps the old version and installs the new plugin gets two glossary importers pointing at the same folder; harmless because stamps are compatible, but the release note should say to disable one.
- Stale `{{vocabularyPath}}` in user custom prompts will now render literally (R-EXT-1.4); acceptable, called out in release notes.
