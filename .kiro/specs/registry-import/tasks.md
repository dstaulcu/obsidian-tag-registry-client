# Tasks: Registry import

Depends on: registry-subscription tasks 1–5.

- [ ] 1. Port pure pipeline (R-IMP-2, R-IMP-3, R-IMP-6, R-IMP-7.3)
  - [ ] 1.1 Copy `stamp.ts`, `plan.ts`, `apply.ts`, `rename.ts` into `src/core/`; fix imports; rename `GlossaryVault`→`RegistryVault`.
  - [ ] 1.2 Copy the matching test blocks from `tests/glossary.test.ts` into `tests/plan.test.ts`, `apply.test.ts`, `rename.test.ts`, `stamp.test.ts`; all green before continuing.
  - [ ] 1.3 Add tests: manifest rejection table (R-IMP-2.1–2.5); hash-mismatch aborts with zero writes (R-IMP-6.1); copy naming `(glossary)`, `(glossary 2)` (R-IMP-5.1); rerun produces all `unchanged` (R-IMP-10.1).
- [ ] 2. Host controller (R-IMP-1, R-IMP-9)
  - [ ] 2.1 `src/host/vaultAdapter.ts` from `vaultAdapter()` in the old controller.
  - [ ] 2.2 `src/host/controller.ts`: define `Host`; implement `importRegistry(host, { mode })` for `interactive` and `notify`; keep the `running` guard; keep `usages`/`renameUsages`.
  - [ ] 2.3 Add `auto` mode (new+updated only, no modal). Test with a fake `Host` + fake vault (asserts conflicts untouched).
  - [ ] 2.4 Orphan counting (R-IMP-8.2): pure helper in `core/plan.ts` taking planned paths + scanned stamped paths; unit test.
- [ ] 3. Preview modal (R-IMP-4, R-IMP-5, R-IMP-7)
  - [ ] 3.1 Port `GlossaryPreviewModal.ts` → `ui/PreviewModal.ts`; wording "tags" instead of "glossary".
  - [ ] 3.2 Manual check: new/updated preselected, conflicts default keep, rename opt-in with usage counts, Cancel writes nothing.
- [ ] 4. Wiring in `main.ts` (R-IMP-1, R-IMP-9)
  - [ ] 4.1 Command `import-tags` "Import / update tags".
  - [ ] 4.2 Startup hook with `onLayoutReady` and `startupMode`.
  - [ ] 4.3 "Import now" button in settings calls the same function.
- [ ] 5. End-to-end check against a real registry in a throwaway vault
  - [ ] 5.1 Each access method; core only; core + one team; all teams; conflict flow; deprecated rename; startup notify; startup auto.
  - [ ] 5.2 Confirm notes imported by the old plugin are recognised as `unchanged` (design D-1).
