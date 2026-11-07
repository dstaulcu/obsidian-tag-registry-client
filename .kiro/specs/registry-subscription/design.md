# Design: Registry subscription

## Overview
Subscription state lives in plugin settings and is edited in the settings tab. Fetching goes through a swappable `RegistrySource` seam so tests, a future registry service, and the three current methods share one interface.

## Data model (`src/settings.ts`)
```ts
interface SourceSetting { id: string; repoUrl: string; ref: string; authMethod: 'https'|'git'|'token'; token: string }
interface RegistrySettings {
  schemaVersion: 1
  sources: SourceSetting[]        // order = precedence
  teams: string[]                 // selected team ids; core implicit
  allTeams: boolean
  knownTeams: ManifestTeam[]      // from last successful manifest read
  destFolder: string
  startupMode: 'off' | 'notify' | 'auto'
}
```
Renamed from the scheduler's `glossary` settings: `checkOnStartup: boolean` becomes `startupMode` (`true`→`notify`, `false`→`off`); `schemaVersion` restarts at 1 because there is no migration. `normalizeSettings(raw)` is total: it validates each field independently (R-SUB-9) and always returns usable defaults.

## Source seam (`src/core/sources.ts`, ported)
```ts
interface RegistrySource { method: AuthMethod; fetchManifest(): Promise<string>; fetchNote(repoPath: string): Promise<string> }
interface SourceDeps { httpGet; run; readFile; exists; platform; cacheDir }
createSource(cfg, deps) // git -> gitSource, else httpSource
```
- `parseRepoUrl` + `rawUrl` build anonymous URLs (GitHub raw vs GitLab `-/raw`). Token method uses the GitHub contents API (`Authorization: Bearer`, `Accept: application/vnd.github.raw+json`) or GitLab v4 files API (`PRIVATE-TOKEN`).
- `checkPath` allows only `registry.json` or a path passing `isSafeNotePath` (R-SUB-3 safety, invariant 2).
- Error messages: `GlossaryError` is renamed `RegistryError(method, message)` → `Registry (<method>): …`. The HTTP failure message appends `[<url>]` (this is the uncommitted change in the scheduler repo's `sources.ts`; the token travels only in headers). Git errors strip `//user:pass@` from stderr.
- Git cache dir: `os.tmpdir()/tag-registry-client-<sha256(url#ref)[0..12]>`, outside the vault.

## Secrets (`src/host/secrets.ts`)
`getToken(src)` / `setToken(src, value)` wrap `app.secretStorage` when it exposes `getSecret`/`setSecret`; otherwise read/write `src.token`. `hasSecretStorage()` drives the plaintext warning (R-SUB-4). Secret id: `tag-registry-client-token-<src.id>`. Removing a source clears its secret.

## Team discovery
`fetchTeams(settings)` = fetch + `parseManifest` per source → `mergeManifests` → `merged.teams`. Called by the "Fetch teams" button and at the start of every import (existing behaviour: `knownTeams` updated only if changed, then `saveData`). Failure path leaves settings untouched (R-SUB-5.3).

Selection semantics are `filterTeams(merged, teams, allTeams)`: keep tag if `source==='core' || allTeams || teams.includes(source)`.

## UI (`src/ui/SettingTab.ts`)
Sections: **Registries** (per-source card: URL, ref, method dropdown, token field shown for `token`, git-availability hint for `git`, remove/up/down), **Teams** (Fetch button, checkbox list with name + description, "All teams" toggle, "not found upstream" badge), **Destination** (folder text with live `destError` validation), **When to import** (startup dropdown), **Import now** button, **Report an issue**.

## Decisions
- Default `destFolder`: `Tags` (the scheduler default `Glossary` conflicted with Tag Review conventions that no longer apply). Open question in README.
- Precedence by list order, matching existing `mergeManifests`.
- No registry default URL, so the plugin never contacts a network host the user did not configure.

## Testing
Port `tests/glossary.test.ts` sections for `parseRepoUrl`/`rawUrl`/source errors (add URL-in-message assertion), `mergeManifests`, `filterTeams`; add `normalizeSettings` table tests (R-SUB-9) and a `startupMode` mapping test.
