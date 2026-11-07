# Tag Registry Client

An Obsidian plugin that keeps your vault's tag glossary in sync with a shared **tag-registry repository**. You subscribe to the registry's `core` tags and to any teams you choose, and the plugin imports them as one markdown note per tag, on demand or when Obsidian starts.

There is no AI, no scheduler and no dependency on any other plugin. The registry is the source of truth; your vault holds a hash-stamped copy, and your local edits are never silently overwritten.

## Requirements

- Obsidian 1.4.0 or newer, **desktop only**.
- `git` on your PATH, only if you use the "Local git" access method.

## Install

Until it is in the community directory, install from a GitHub release: download `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/tag-registry-client/`, restart Obsidian and enable **Tag Registry Client** under Settings → Community plugins.

## Set up

Open **Settings → Tag Registry Client**.

1. **Registry.** Enter the repo URL (`https://github.com/owner/repo`, or a GitLab-style `https://host/group/.../repo`), the branch or tag (default `main`) and an access method. There is no default registry: the plugin contacts only hosts you configure. You can add several registries (for example a public one and an internal one); the earlier one wins on a duplicate tag, and the arrows reorder them.
   - **Anonymous HTTPS**: raw file access for public repos.
   - **Local git**: a shallow clone cached outside your vault, using your own git credentials. Git is never run through a shell and never prompts.
   - **Access token**: a read-only personal access token, used through the GitHub or GitLab API.
2. **Teams.** Press **Fetch teams**, then tick the teams you want, or turn on **All teams**. Core tags are always included. Teams nest: ticking a team also ticks its parents (switchable), and placeholder teams the registry marks `example` are hidden unless you show them. A ticked team that no registry lists any more stays selected, is flagged "not found upstream", and its notes are left alone.
3. **Destination.** The vault folder to import into (default `Tags`). Notes land at `<folder>/core/<facet>/<name>.md` and `<folder>/<team path>/<facet>/<name>.md (nested teams become nested folders)`. Absolute paths, `..` and hidden folders are rejected.
4. **When to import.** See below.

## Importing

Run **Import / update tags** from the command palette or the settings tab. The plugin fetches every registry, plans the changes and opens a preview. Nothing is written until you press **Apply**. If any registry fails or any download does not match its hash, the whole run aborts and no notes change.

Each note is stamped with a `glossary_hash` front-matter key recording the upstream version it came from. That stamp is how the plugin tells your edits from upstream changes:

| Category | Meaning | Default |
|---|---|---|
| New | no local note | imported |
| Updated | you have not edited it since the last import, or it already matches upstream but lacks a stamp | imported |
| Unchanged | matches upstream and the stamp | nothing to do |
| Conflict | you edited it and upstream differs | **keep mine** |

For a conflict you can keep yours, use theirs (overwrite), or save theirs as a copy (`<name> (glossary).md`, then `(glossary 2)`, …). A conflicting note is never overwritten unless you choose "use theirs".

**Deprecated tags** that name a replacement are listed with the number of notes outside the destination that use them. Rewriting those notes to the new tag is optional and off unless you tick it.

If a tag disappears upstream or you unsubscribe from a team, its note stays in your vault and is never deleted. The summary mentions how many such notes there are.

### At startup

| Mode | Behaviour |
|---|---|
| Off | Does nothing. |
| **Notify** (default) | Checks for changes and shows a notice. Never writes. |
| Auto-import | Adds new and updated tags without asking. Conflicts and renames are left for you to review. |

Startup failures go to the developer console and never raise an error popup.

## Privacy

- The plugin fetches only from the registries you configure, and only the manifest and the notes you subscribe to.
- Tokens are kept in Obsidian's secret storage when your version has it. Otherwise they are saved as plain text in the plugin's `data.json` and the settings tab warns you; exclude that file from sync. Use a **read-only** token.
- Tokens are sent only as request headers and never appear in notices, logs or the diagnostics report.
- The git cache lives in your system temp folder, outside the vault.

## Debugging

Turn on **Debug logging** in the plugin settings, then open the developer console (Ctrl+Shift+I) and filter for `tag-registry-client`. You'll see each import phase with counts and timings. Logs never include tokens, repo credentials, folders, note content or vault paths. Warnings and errors are always logged, with or without the setting.

## Reporting a bug

**Settings → Tag Registry Client → Report an issue** copies a diagnostics block (versions, platform, counts of sources and teams, access methods, startup mode, whether secret storage exists) and opens the bug form. It never includes tokens, repo URLs, team names, folders, note content or vault paths.

## Registry format

See [`.kiro/README.md`](.kiro/README.md) for the manifest v2 contract and the product specs in [`.kiro/`](.kiro/).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md).
