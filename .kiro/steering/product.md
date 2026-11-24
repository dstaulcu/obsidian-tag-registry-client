# Product: Tag Registry Client (working name)

A desktop Obsidian plugin that keeps a vault's tag glossary in sync with a shared **tag-registry repository**.
It is deliberately small and has **no AI, no scheduler, and no dependency on the Scheduled Agents plugin**.

## What it does
1. **Identify** one or more tag-registry repos (URL, branch/tag, access method).
2. **Subscribe** to the registry's `core` tags and to any chosen `teams/<team>` tag sets.
3. **Import** the subscribed tags as one markdown note per tag, on demand or when Obsidian starts.
4. **Create missing tag pages** for tags used in the vault that no registry defines, after the user confirms (see `tag-pages`).

## What it does not do
- Run agents, review tags, propose or apply tag edits to user notes (Tag Review is removed from the product line).
- Maintain a single "vocabulary note" or bridge into any other plugin.
- Migrate settings from Scheduled Agents. Users start fresh.
- Write anything outside the chosen destination folder, except opt-in tag renames (see registry-import) and confirmed new pages in the tag page folder (see tag-pages).
- Groom tags with judgment (definitions, backfilling tags onto notes, proposing tags upstream). That is an agent's job; see `tag-grooming`.

## Principles
- **Registry is the source of truth**; the vault holds a hash-stamped copy. Local edits are never silently overwritten.
- **Preview before write.** Interactive imports always show a plan the user confirms. Failures abort before any write.
- **Read-only toward the registry.** Tokens, where used, are read-only and stay in Obsidian secret storage when available.
- **Desktop-only** (git method and filesystem cache need Node).

## Origin
Extracted from `obsidian-scheduled-agents` (`src/glossary/*`, introduced in PRs #23 and the `multi-team-registry` branch).
Specs live in `.kiro/specs/`. The registry manifest contract ("manifest v2") is summarised in `README.md`.
