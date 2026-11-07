# Tag Registry Client — specs

Kiro-style specs for a new, **non-AI** Obsidian plugin extracted from `obsidian-scheduled-agents`.
The plugin subscribes to a shared tag-registry repo (core + chosen teams) and imports its tags as notes, on demand or at startup.
Tag Review is **removed**, and nothing is migrated. No code exists yet; these specs are what to build from.

## Index
| Spec | Covers |
|---|---|
| [`registry-subscription`](specs/registry-subscription/requirements.md) | Identify registries, access methods, tokens, team discovery and selection, destination, startup mode |
| [`registry-import`](specs/registry-import/requirements.md) | Manifest v2 validation, plan/preview/apply, conflicts, hash stamps, deprecated-tag rename, startup notify/auto |
| [`plugin-foundation`](specs/plugin-foundation/requirements.md) | Identity, build/test/CI/release, diagnostics, docs |
| [`scheduler-extraction`](specs/scheduler-extraction/requirements.md) | Removing Tag Review and the importer from `obsidian-scheduled-agents` |
| [steering](steering/) | Product intent, tech stack, structure and invariants |

Suggested order: plugin-foundation 1–4 → registry-subscription → registry-import → plugin-foundation 5–8 → scheduler-extraction.
Each spec has `requirements.md` (EARS), `design.md`, `tasks.md`; requirement ids (`R-SUB-n`, `R-IMP-n`, `R-FND-n`, `R-EXT-n`) are referenced from tasks.

## The registry contract (manifest v2)
The plugin and the tag-registry repo meet at this interface. Anything that changes it needs a version bump on both sides.

Authoritative upstream spec: https://github.com/dstaulcu/tag-registry/blob/main/docs/specification.md (the producer script wins if they disagree).

Repo layout (teams nest to any depth; a folder with a `team.md` is a team, its id is its folder path):
```
registry.json
core/<facet>/<name>.md
teams/<team>/<facet>/<name>.md
teams/<team>/<sub-team>/<facet>/<name>.md
```
`registry.json`:
```json
{ "version": 2,
  "facets": ["area", "tool", "project"],
  "teams": [{ "id": "org/component", "name": "Component", "description": "…", "level": "component", "parent": "org", "example": false }],
  "tags": [{ "tag": "tool/git", "facet": "tool", "source": "core", "status": "active|proposed|deprecated",
             "replaced_by": null, "aliases": ["#tool/git"], "definition": "…",
             "path": "core/tool/git.md", "hash": "<sha256 of note text>" }] }
```
Segments are lowercase kebab-case. `facet` and `source` are read from the manifest, never derived from `path`; the plugin only checks that the path agrees (`core/<facet>/<name>.md` or `teams/<source>/<facet>/<name>.md`, `tag` = `facet/name`). Teams are visible to themselves and everything below them, so choosing a team also offers its ancestors (`includeAncestors`, default on). Teams with `example: true` are hidden unless `showExampleTeams`. Notes land at `<dest>/core/...` and `<dest>/<team path>/...` with a `glossary_hash` front-matter stamp.

## Open questions
1. **Name/id**: "Tag Registry Client" / `tag-registry-client` / folder `obsidian-tag-registry-client` are assumptions. Change in `src/brand.ts`, `manifest.json`, the secret id and the cache dir prefix if you pick another.
2. **Orphans**: when a tag or team leaves the subscription, notes stay. Should the summary list them (current spec, informational) or ignore them?
3. **Default destination**: spec says `Tags`; the scheduler used `Glossary`. Using `Glossary` makes already-imported notes show as `unchanged`.
4. **Startup `auto` mode**: included as opt-in because you asked for at-startup imports; default is `notify`. Drop `auto` if you want startup to never write.
5. **Stamp key**: kept as `glossary_hash` for compatibility with notes imported by the old plugin and with the registry's tooling. Rename only if the registry repo changes too.
