# Design: Tag grooming (design only, no code here)

Grooming keeps a vault's tags aligned with the registry without taking anyone's freedom to tag. The registry sets a happy path and enforces nothing. People and agents keep creating tags; grooming reconciles them afterwards, always with a person reviewing before notes change.

## The loop
1. **Inventory.** Every tag in use, with note counts; which have a page; which are registry tags (and their status); which are local.
2. **Normalize.** Propose renames for tags that miss the `<facet>/<name>` kebab-case shape or duplicate a registry tag: `#Project/WiFi` → `#project/wifi-router-transition`, `#tools/git` → `#tool/git`, deprecated → `replaced_by`. Output: a rename list the person ticks.
3. **Pages.** Create missing tag pages (this plugin's "Create missing tag pages"), then draft the empty `Definition:` lines from how the tag is used. Definitions are proposals in the page, not facts.
4. **Backfill.** For each tag with a definition, find notes that match it but lack the tag, and propose adding it: per note, the tag and the sentence that justifies it. Nothing is written until the person accepts each one (or a batch).
5. **Promote.** Local tags that a team would share become a pull request to the registry: move the page to `teams/<team>/<facet>/<name>.md`, set `owner`, keep `status: proposed`, run `npm run manifest`. People tags (`with/<person>`) and anything private never leave the vault.

## Where each piece lives
| Step | Home | Why |
|---|---|---|
| Inventory, page creation | **This plugin** | Deterministic, vault-local, already knows the registry and the destination. Shipped as "Create missing tag pages". |
| Rename of non-conforming tags | **This plugin, later** (opt-in, previewed) | The rename engine (`core/rename.ts`) already exists for deprecated tags; a mechanical mapping (case, plural, known `replaced_by`) needs no AI. Fuzzy matches go to the agent. |
| Definitions, backfill, fuzzy renames | **An agent skill**, not this plugin | Needs judgment (reading notes against definitions). The plugin's product rule is no AI and no edits to user notes beyond opt-in renames. A Claude Code skill or scheduled agent over the vault fits: it reads the registry's `definition` lines and the local pages, writes a review note, and applies only what the person ticks. |
| Promote to registry | **The agent skill, opening a PR on the registry repo** | Needs git credentials with write access and a human-reviewed PR. This plugin is read-only toward the registry by design. |
| Format, rules, CI | **The registry repo** | Documents tag pages and grooming for every client (`docs/`), and its CI already validates proposed notes. |

## Safety rules for any grooming tool
- Preview everything; write nothing to notes until accepted. Never delete a tag or a page.
- Edit tags only in front matter `tags:` and inline `#tags`, never inside code (reuse `renameTagInText`).
- Keep people tags and anything private out of registry pull requests.
- Record what was applied (a dated grooming note) so a run can be reviewed or undone.

## Open questions
1. Should the plugin's inventory become a report note (tags, counts, status) that the agent reads, so the agent needs no vault parsing of its own?
2. Does mechanical normalization (step 2 without fuzzy matching) belong in this plugin's next release?
