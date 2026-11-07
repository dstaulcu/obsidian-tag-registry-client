# Contributing

## Flow

1. Branch from an up-to-date `main`: `git switch main && git pull && git switch -c <type>/<short-name>` (for example `feat/startup-auto`, `fix/team-badge`, `docs/readme`).
2. Make small, focused commits with imperative messages.
3. Before pushing, run the checks locally:
   ```bash
   npm run type:check
   npm test
   npm run build
   ```
4. Push and open a pull request into `main` (`gh pr create --base main --fill`). Say what changed, why, and how you tested it.
5. Another contributor reviews. Address comments with new commits, then squash-merge.
6. Don't push directly to `main`, except for trivial doc fixes.

## Code guidelines

- `src/core` must not import `obsidian` (a test enforces it). Environment access (HTTP, git, filesystem, vault, secrets) is injected through interfaces defined in core.
- Respect the invariants in `.kiro/steering/structure.md`: no write before the user confirms the preview (except opt-in `auto` startup), safe paths only, hash-verified downloads, all-or-nothing fetching, no secrets or content in diagnostics, no dependency on other plugins.
- Changes to the manifest contract need a version bump on both the plugin and the registry repo.
- Add or update tests in `tests/` for behaviour changes, and update `README.md` and `CLAUDE.md` when commands, architecture or user-visible behaviour change.

## Trying changes in Obsidian

Use a throwaway vault. Create it in Obsidian, open it once so it has a `.obsidian` folder, then create `.deploy.json` (gitignored) in the repo root:

```json
{ "vault": "/path/to/the/throwaway/vault" }
```

`OBSIDIAN_VAULT` works instead of the file, and a path argument overrides both. Then `npm run deploy` builds and copies `main.js`, `manifest.json` and `styles.css` into the vault's plugin folder (`tag-registry-client`). Reload Obsidian or toggle the plugin; your `data.json` is not touched.

Manual checks worth doing against a real registry: each access method; core only, core plus one team, all teams; a conflict (edit an imported note, change it upstream, import); a deprecated tag with the rename ticked and unticked; startup `notify` and `auto`.

## Releases

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test` and `npm run build` on every PR and push to `main`. A bare semver tag (for example `0.2.0`) triggers `.github/workflows/release.yml`, which checks the tag equals the `manifest.json` version and publishes `main.js`, `manifest.json` and `styles.css`.

Versions in `manifest.json`, `package.json` and `versions.json` change only through `scripts/release.mjs`. From a clean, up-to-date `main`:

```bash
npm run ship          # patch: test, bump, build, open PR, wait for CI, merge, tag
npm run ship:minor
npm run ship:major
```

`npm run ship -- --no-merge` stops after opening the PR for review; after it merges, run `npm run ship -- --finish`. `npm run release` and `npm run tag` do the bump and the tag separately.
