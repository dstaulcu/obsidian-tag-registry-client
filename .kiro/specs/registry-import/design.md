# Design: Registry import

## Pipeline
```
settings ──► createSource(cfg, nodeDeps) per source ──► fetchManifest ──► parseManifest
        └─► mergeManifests ──► filterTeams ──► planImport(readLocal) ──► ImportPlan
                                   │
         checkOnly/notify ◄────────┤ summarize(counts) → Notice
         interactive      ────────►│ PreviewModal(plan) ─► Decision[] + Rename[]
         auto             ────────►│ Decision[] = new+updated only
                                   ▼
                  applyImport(decisions, fetchNote, vault)  ─► Notice(counts)
                  renameUsages(per ticked rename)
```
All stages except the Obsidian adapters are ported verbatim from the scheduler repo and stay pure.

## Components (ported, with the change noted)
| New file | From | Change |
|---|---|---|
| `core/manifest.ts` | `glossary/manifest.ts` | none |
| `core/plan.ts` | `glossary/plan.ts` | none (`vaultPathFor`, `planImport`, `summarize`) |
| `core/apply.ts` | `glossary/apply.ts` | rename `GlossaryVault`→`RegistryVault` |
| `core/stamp.ts` | `glossary/stamp.ts` | none (`sha256`, `stripStamp`, `readStamp`, `stamp`) |
| `core/rename.ts` | `glossary/rename.ts` | none |
| `host/controller.ts` | `glossary/controller.ts` | drop `AgentPlugin` coupling: take a `Host` object (below); add `mode: 'interactive'\|'notify'\|'auto'` |
| `ui/PreviewModal.ts` | `ui/GlossaryPreviewModal.ts` | import paths + wording |

The stamp key stays `glossary_hash` so notes are interchangeable with those imported by Scheduled Agents (no migration is needed, but a user who already imported notes keeps them recognised as unchanged, which is a free benefit). This is a deliberate compatibility decision; design note D-1.

## Host interface (replaces `AgentPlugin`)
```ts
interface Host {
  app: App                         // vault, adapter
  settings: RegistrySettings
  saveSettings(): Promise<void>
}
```
`importRegistry(host, { mode })` replaces `importGlossary(plugin, { checkOnly })`. `mode`:
- `interactive`: current behaviour.
- `notify`: current `checkOnly` behaviour.
- `auto`: after planning, build `Decision[]` from `new`/`updated` items (conflicts excluded, renames none) and call `applyImport` directly; notice with counts plus conflict count.

A module-level `running` guard remains (R-IMP-1.4).

## Vault adapter (`host/vaultAdapter.ts`)
`read` via `adapter.exists/read` with `normalizePath`; `create` makes missing parent folders one segment at a time then `vault.create`; `modify` requires a `TFile` from `getAbstractFileByPath` and throws "not in the vault index yet; try again" otherwise. Unchanged from the scheduler repo.

## Plan algorithm (R-IMP-3)
```
localHash = sha256(stripStamp(local)); stamp = readStamp(local)
if local==null → new
elif localHash==entry.hash → stamp==entry.hash ? unchanged : updated
elif stamp && localHash==stamp → updated
else conflict
```

## Apply algorithm (R-IMP-6)
Two phases for atomicity of intent: (1) fetch + hash-verify all selected → throws before writing; (2) write sequentially. Phase 2 can still fail mid-way (e.g. disk); the notice reports the error and a re-run is safe because planning is idempotent.

## Startup (R-IMP-9)
`main.ts onload`: `app.workspace.onLayoutReady(() => startupMode !== 'off' && importRegistry(host, { mode: startupMode === 'auto' ? 'auto' : 'notify' }))`. Errors in non-interactive modes are `console.warn`ed with `LOG_TAG`.

Auto-mode caution: it is the only path that writes without a modal, so it is opt-in, excludes conflicts and renames, and still goes through the hash check.

## Orphans (R-IMP-8.2)
After planning, scan `<dest>` for markdown files with a `glossary_hash` stamp whose vault path is not in the plan; count them in the summary text only. Cheap (adapter list), no writes. Marked SHOULD pending README Q2.

## Error handling
`RegistryError` messages are shown as-is; others are prefixed `Registry:`; every failure notice ends with "No notes were changed." Console gets the full error with `LOG_TAG`. Tokens are only ever in request headers, so error strings and URLs are safe.

## Testing
Port the whole glossary suite (plan categories, apply with fake vault incl. hash-mismatch abort and copy naming, rename, stamp). Add: `auto` mode skips conflicts; `notify` never writes (fake vault asserts zero calls); orphan counting; rerun idempotence.
