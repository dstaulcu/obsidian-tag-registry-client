# Tech

- TypeScript (strict), bundled with esbuild to `main.js` (cjs, es2020; externals: `obsidian`, `electron`, Node builtins).
- Tests: Jest + ts-jest, node environment, `tests/**/*.test.ts`. Same toolchain versions as `obsidian-scheduled-agents` so scripts port unchanged.
- Obsidian `minAppVersion` 1.4.0; `isDesktopOnly: true`. Secret storage (`app.secretStorage`) is used when present, with a plaintext `data.json` fallback that the UI warns about.
- Network: Obsidian `requestUrl` (https and token methods); `child_process.execFile` (no shell) for git, with `GIT_TERMINAL_PROMPT=0`.
- Hashing: Node `crypto` sha256.
- Commands (same names as the sibling repo): `npm test`, `npm run type:check`, `npm run build`, `npm run dev`, `npm run deploy`, `npm run ship[:minor|:major]`, `npm run release[...]`.
- Release: bare-semver tag publishes `main.js`, `manifest.json`, `styles.css`; versions bumped only by `scripts/release.mjs`.

## Architecture rule
`src/core/` is pure (no `obsidian` import) and unit-tested under node. Everything environment-specific (HTTP, git, filesystem, vault, secrets, clock) is injected through small interfaces defined in core.
