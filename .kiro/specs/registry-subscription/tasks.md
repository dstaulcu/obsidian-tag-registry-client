# Tasks: Registry subscription

Depends on: plugin-foundation tasks 1–4 (scaffold, brand, build/test).

- [ ] 1. Port the fetch seam (R-SUB-1, R-SUB-3)
  - [ ] 1.1 Copy `src/glossary/sources.ts` → `src/core/sources.ts`; rename `GlossarySource`→`RegistrySource`, `GlossaryError`→`RegistryError`, message prefix `Registry (<method>)`.
  - [ ] 1.2 Keep the `[<url>]` suffix on non-200 errors; add a test that the token never appears in any error string.
  - [ ] 1.3 Copy source-related cases from `tests/glossary.test.ts` into `tests/sources.test.ts`.
- [ ] 2. Port manifest handling (R-SUB-2, R-SUB-5, R-SUB-6)
  - [ ] 2.1 Copy `manifest.ts` → `src/core/manifest.ts` unchanged (types, `isSafeNotePath`, `vaultRelPath`, `parseManifest`, `mergeManifests`, `filterTeams`).
  - [ ] 2.2 Port tests; add: duplicate-tag precedence warning names the tag; unknown team id retained.
- [ ] 3. Settings model (R-SUB-7, R-SUB-8, R-SUB-9)
  - [ ] 3.1 Write `src/settings.ts` with `RegistrySettings`, `defaultSettings()`, `normalizeSettings()`, `newSource()`.
  - [ ] 3.2 Tests first: malformed/partial/unknown-method/extra-key inputs; `destError` cases (empty, absolute, `..`, hidden segment).
  - [ ] 3.3 Move `destError` into `src/core/` (pure).
- [ ] 4. Secrets (R-SUB-4)
  - [ ] 4.1 `src/host/secrets.ts` with `secretId(src)` = `tag-registry-client-token-<id>`, `hasSecretStorage`, `getToken`, `setToken`, `clearToken`.
  - [ ] 4.2 Take an `app`-like `{ secretStorage? }` parameter instead of the plugin object so it is unit-testable with a fake.
- [ ] 5. Node adapters (R-SUB-3)
  - [ ] 5.1 `src/host/nodeDeps.ts`: `requestUrl` GET (`throw:false`), `execFile` with `windowsHide`, 120 s timeout, `GIT_TERMINAL_PROMPT=0`, `fs.promises` read/exists, cache dir `tag-registry-client-<hash12>`.
- [ ] 6. Settings tab (R-SUB-1…8)
  - [ ] 6.1 Registries cards with add/remove/reorder; URL format validation message.
  - [ ] 6.2 Teams section with Fetch button, checkboxes, All-teams toggle, "not found upstream" badge.
  - [ ] 6.3 Destination field with live validation; startup mode dropdown; plaintext-token warning.
  - [ ] 6.4 Manual check in a throwaway vault against a real registry for each method.
