# Requirements: Registry import

## Introduction
Turns the current subscription into notes in the vault: fetch manifests, compute a plan against what is already there, let the user review it, then write. Local edits are protected by a content-hash stamp.

## Glossary
- **Stamp**: front-matter key `glossary_hash: "<sha256>"` added as the last key of an imported note; records the upstream hash the note was imported from.
- **Plan categories**: `new` (no local file), `updated` (local unchanged since last import, or identical to upstream but unstamped), `unchanged`, `conflict` (local differs from both the stamp and upstream).
- **Manifest v2**: `registry.json` with `version: 2`, `facets[]`, `teams[]`, `tags[]` (see README for fields).

## Requirements

### R-IMP-1 Run an import
1. WHEN the user runs "Import / update tags", THE SYSTEM SHALL fetch every configured source's manifest, merge them, filter to core plus the subscribed teams, and compute a plan.
2. IF no source has a repo URL, THEN THE SYSTEM SHALL tell the user to set one in settings and do nothing else.
3. IF the destination folder is invalid, THEN THE SYSTEM SHALL tell the user and do nothing else.
4. IF an import is already running, THEN THE SYSTEM SHALL ignore the new request.
5. IF any source fails to answer or its manifest is invalid, THEN THE SYSTEM SHALL abort before any write and report "No notes were changed", naming the failing repo URL.

### R-IMP-2 Manifest validation
1. THE SYSTEM SHALL reject a manifest whose `version` is not 2 or whose `tags` is not an array.
2. THE SYSTEM SHALL reject any tag whose `path` is not `core/<facet>/<name>.md` or `teams/<team>/<facet>/<name>.md` with lowercase-kebab segments, no `..`, no hidden segments, no backslashes.
3. THE SYSTEM SHALL reject a tag whose `hash` is not 64 lowercase hex chars, and a tag whose facet is not in `facets` when `facets` is non-empty.
4. THE SYSTEM SHALL derive `source` and `facet` from the path, not from the file's own fields.
5. THE SYSTEM SHALL ignore teams with ids that are not lowercase-kebab, and default missing `status` to `active`.

### R-IMP-3 Planning
1. THE SYSTEM SHALL map `core/x` → `<dest>/core/x` and `teams/<t>/x` → `<dest>/<t>/x`.
2. WHEN a local note is absent, THE SYSTEM SHALL classify it `new`.
3. WHEN the local text (stamp removed) hashes to the manifest hash, THE SYSTEM SHALL classify it `unchanged` if stamped with that hash, otherwise `updated` (to add the stamp).
4. WHEN the local hash equals its stamp (untouched since import) but differs from the manifest, THE SYSTEM SHALL classify it `updated`.
5. OTHERWISE THE SYSTEM SHALL classify it `conflict`.
6. THE SYSTEM SHALL count deprecated tags separately in the summary.

### R-IMP-4 Preview and confirmation
1. WHEN there are new, updated, conflicting or renameable deprecated items, THE SYSTEM SHALL open a preview listing them by category and SHALL write nothing until the user presses Apply.
2. THE SYSTEM SHALL preselect `new` and `updated`; conflicts default to "keep mine".
3. WHEN there is nothing to do, THE SYSTEM SHALL show a one-line summary instead of the modal.
4. THE SYSTEM SHALL let the user cancel with no changes.

### R-IMP-5 Conflict handling
1. FOR each conflict, THE SYSTEM SHALL offer **keep mine** (skip, default), **use theirs** (overwrite with stamped upstream), **save as copy** (`<name> (glossary).md`, then `(glossary 2)`, … without overwriting existing files).
2. THE SYSTEM SHALL never overwrite a conflicting note unless the user chose "use theirs".

### R-IMP-6 Applying
1. THE SYSTEM SHALL download every selected note first and verify its sha256 equals the manifest hash; IF any download fails or mismatches, THEN THE SYSTEM SHALL abort with nothing written.
2. THE SYSTEM SHALL then write: create with parent folders for `new`, modify for `updated`/`theirs`, create copies for `copy`.
3. THE SYSTEM SHALL stamp each written note with the manifest hash.
4. THE SYSTEM SHALL report counts of new, updated, copies and kept-as-yours.
5. THE SYSTEM SHALL write only inside the destination folder and never into a hidden folder.

### R-IMP-7 Deprecated tags and opt-in rename
1. FOR each deprecated tag with `replaced_by`, THE SYSTEM SHALL list it in the preview with the count of vault notes (outside the destination) that use `#tag`.
2. THE SYSTEM SHALL rewrite those notes only for renames the user explicitly ticks (off by default), via the vault's atomic `process` API.
3. THE SYSTEM SHALL match tags at word boundaries in body and front matter only as `renameTagInText` does today, and SHALL NOT touch the destination folder.
4. THE SYSTEM SHALL report how many notes each rename touched.

### R-IMP-8 Unsubscribed and removed tags
1. WHEN a tag disappears upstream or its team is unsubscribed, THE SYSTEM SHALL leave the local note in place and SHALL NOT delete it.
2. THE SYSTEM SHOULD list such stamped-but-no-longer-subscribed notes as "orphaned" in the summary (informational only). *(Open question: README Q2.)*

### R-IMP-9 Startup behaviour
1. WHEN Obsidian starts AND `startupMode` is `off`, THE SYSTEM SHALL do nothing.
2. WHEN `startupMode` is `notify`, THE SYSTEM SHALL run the planning step only, and IF anything is new, updated or conflicting, SHALL show a notice "N new, M updated … Run 'Import / update tags' to review." and SHALL NOT write.
3. WHEN `startupMode` is `auto`, THE SYSTEM SHALL apply `new` and `updated` items without a modal and SHALL leave conflicts and renames untouched, then show a notice with counts and "N conflicts need review".
4. A startup failure SHALL be logged to the console and SHALL NOT raise a blocking error notice.
5. THE SYSTEM SHALL delay the startup run until the vault layout is ready.

### R-IMP-10 Idempotency and safety
1. Running an import twice with no upstream change SHALL produce `unchanged` for every note and write nothing.
2. THE SYSTEM SHALL never include the token in any notice, log line or error.
3. THE SYSTEM SHALL leave the working tree of the git cache untouched by user data (cache is outside the vault).
