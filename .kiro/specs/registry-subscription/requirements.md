# Requirements: Registry subscription

## Introduction
Lets a user say **where** the tag registry is and **which parts** of it they subscribe to: the always-on `core` plus any number of `teams/<team>` tag sets. Subscription is configuration only; fetching and writing notes is covered by `registry-import`.

## Glossary
- **Registry**: a git repo containing `registry.json` (manifest v2) and note files under `core/` and `teams/<team>/`.
- **Source**: one configured registry (URL, ref, access method, optional token).
- **Subscription**: the set of teams the user selected (or "all teams"); `core` is implicit and always included.

## Requirements

### R-SUB-1 Identify a registry
**User story:** As a user, I want to enter my organisation's registry URL so the plugin knows where tags come from.
1. WHEN the user adds a source, THE SYSTEM SHALL accept an `https://` repo URL (`github.com/owner/repo` or a GitLab-style `host/group/.../repo`), a ref (branch or tag, default `main`), and an access method.
2. IF the URL does not parse as an https repo URL, THEN THE SYSTEM SHALL show the expected format and SHALL NOT save it as valid.
3. THE SYSTEM SHALL ship with one empty source row so a first-time user sees where to start; it SHALL NOT ship with any default registry URL.

### R-SUB-2 Multiple registries
1. THE SYSTEM SHALL support more than one source (for example a public registry plus an internal one).
2. WHEN two sources define the same tag or path, THE SYSTEM SHALL use the earlier source and log a warning naming the tag.
3. THE SYSTEM SHALL let the user add, remove and reorder sources; order determines precedence.

### R-SUB-3 Access methods
1. THE SYSTEM SHALL offer `https` (anonymous raw file access), `git` (shallow clone cached outside the vault, uses the user's git credentials), and `token` (read-only personal access token via host API).
2. WHEN the method is `git` AND git is not on PATH, THE SYSTEM SHALL report that git was not found and suggest another method.
3. WHEN the method is `token` AND no token is set, THE SYSTEM SHALL fail with "no token configured" before any request.
4. WHEN a request fails, THE SYSTEM SHALL name the method tried and include the HTTP status class and the request URL (never the token) in the message.
5. THE SYSTEM SHALL never run git through a shell and SHALL disable git credential prompts.

### R-SUB-4 Token storage
1. WHERE Obsidian secret storage is available, THE SYSTEM SHALL store tokens there under `tag-registry-client-token-<sourceId>` and keep `token` empty in `data.json`.
2. WHERE secret storage is unavailable, THE SYSTEM SHALL store the token in `data.json` and SHALL display a visible warning that it is plain text.
3. THE SYSTEM SHALL describe the token as needing read-only scope.

### R-SUB-5 Discover teams
1. WHEN the user presses "Fetch teams" (or after any successful import run), THE SYSTEM SHALL read each source's manifest and record the union of `teams[]` (id, name, description) as `knownTeams`.
2. THE SYSTEM SHALL show `knownTeams` in the picker even before the next fetch, using the saved list.
3. IF a source cannot be reached, THEN THE SYSTEM SHALL keep the previous `knownTeams` and show the error; it SHALL NOT clear the selection.

### R-SUB-6 Choose a subscription
1. THE SYSTEM SHALL always include `core` tags.
2. THE SYSTEM SHALL let the user tick individual teams, or choose "all teams".
3. WHEN "all teams" is on, THE SYSTEM SHALL ignore individual ticks but retain them for when it is turned off.
4. IF a ticked team no longer exists in any manifest, THEN THE SYSTEM SHALL keep the id selected and flag it as "not found upstream"; it SHALL NOT delete local notes.

### R-SUB-7 Destination folder
1. THE SYSTEM SHALL let the user choose a vault folder for imported notes (default `Tags`; final default decided in design).
2. IF the folder is empty, absolute, contains `..`, or has a hidden segment (starts with `.`), THEN THE SYSTEM SHALL reject it with "Choose a normal vault folder (no hidden folders)".
3. THE SYSTEM SHALL lay notes out as `<dest>/core/<facet>/<name>.md` and `<dest>/<team>/<facet>/<name>.md`.

### R-SUB-8 Import timing
1. THE SYSTEM SHALL offer a startup mode with three values: `off`, `notify` (default), `auto` (see registry-import R-IMP-9).
2. THE SYSTEM SHALL offer a command "Import / update tags" for on-demand runs, regardless of startup mode.

### R-SUB-9 Settings robustness
1. WHEN `data.json` is missing, partial or malformed, THE SYSTEM SHALL fall back to defaults field by field without throwing.
2. WHEN an unknown `authMethod` is stored, THE SYSTEM SHALL treat it as `https`.
3. THE SYSTEM SHALL tolerate and ignore unrelated keys in `data.json`.
