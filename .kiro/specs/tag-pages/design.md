# Design: Tag pages

## Shape
- `src/core/tagPages.ts` (pure): `normalizeTag`, `tagPageFolderError`, `conformingFacet`, `planTagPages`, `tagPageText`, and `runCreateTagPages(env)` against an injected `TagPageEnv` (registries via `loadRegistries`, a vault scan, a read/create vault, a confirm callback, notices, logger). Unit tested with fakes in `tests/tagPages.test.ts`.
- `src/host/vaultAdapter.ts` `scanTags(app, exclude)`: reads Obsidian's metadata cache (`getAllTags`, `parseFrontMatterAliases`); returns note counts per lowercased tag outside the excluded folders, and every `#` alias in the vault.
- `src/ui/TagPageModal.ts`: one toggle per page (default on), skip summary, Cancel / Create. `openAndWait()` like `PreviewModal`.
- `host/controller.ts` `createTagPages(host)`; command `create-tag-pages` "Create missing tag pages"; a "Tag pages" section in settings with the folder and a button.

## Decisions
- **D-TP-1 Registry tags are never stubbed.** The import is the only writer of registry tags' pages, so a vault never holds two notes with the same `#tag` alias (Tag Wrangler would pick one at random). Every registry tag counts, not only subscribed teams, so subscribing later does not create a duplicate.
- **D-TP-2 Default folder `Tags/_local`.** Next to the imported tags, and `_local` can never be a team id or `core`, so it cannot collide with an import path even on a case-insensitive file system.
- **D-TP-3 Registry note format.** A local page is a valid registry note apart from `owner: local`, so promoting it upstream is a move plus an `owner` change (see `tag-grooming`).
- **D-TP-4 No AI, no note edits.** Writing a definition or tagging notes needs judgment; that is grooming, which lives outside this plugin.

## Not in scope
Renaming non-conforming tags, filling definitions, retagging notes, proposing tags upstream: see `../tag-grooming/design.md`.
