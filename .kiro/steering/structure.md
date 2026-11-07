# Structure and invariants

```
src/
  main.ts                 # plugin wiring only: commands, startup check, settings load/save
  brand.ts                # PLUGIN_ID, NAME, LOG_TAG, REPO_URL, DEFAULT_DEST_FOLDER
  settings.ts             # RegistrySettings, defaults, normalizeSettings
  core/                   # pure logic, no obsidian imports
    manifest.ts           # parse/validate/merge/filter manifest v2   (from glossary/manifest.ts)
    sources.ts            # fetch seam: https | git | token           (from glossary/sources.ts)
    plan.ts               # diff manifest vs local                    (from glossary/plan.ts)
    apply.ts              # fetch-all-then-write                      (from glossary/apply.ts)
    stamp.ts              # glossary_hash stamping                    (from glossary/stamp.ts)
    rename.ts             # in-text tag rename                        (from glossary/rename.ts)
    diagnostics.ts        # "Report an issue" text
  host/                   # Obsidian/Node adapters
    controller.ts         # orchestration (importRegistry)            (from glossary/controller.ts)
    nodeDeps.ts           # requestUrl/execFile/fs -> SourceDeps
    vaultAdapter.ts       # RegistryVault over app.vault
    secrets.ts            # secret storage + fallback
  ui/
    SettingTab.ts         # sources, team picker, destination, startup mode
    PreviewModal.ts       # (from ui/GlossaryPreviewModal.ts)
tests/                    # mirrors core/, plus settings + diagnostics
.kiro/{steering,specs}/
```

## Invariants
1. Nothing is written to the vault until the user confirms the preview, except an explicitly enabled auto-import that touches only non-conflicting notes (see registry-import R-IMP-9).
2. Every note path from a manifest passes `isSafeNotePath` before use; hidden folders are never written; destination must pass `destError`.
3. Downloaded note text must match its manifest sha256 before it is stamped or written.
4. All sources are fetched and validated before any write; one failure aborts the whole run.
5. Diagnostics never include tokens, repo URLs with credentials, note content, or vault paths.
6. No import from, or runtime reference to, the Scheduled Agents plugin.
