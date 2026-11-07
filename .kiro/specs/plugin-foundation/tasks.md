# Tasks: Plugin foundation

- [ ] 1. Repo scaffold (R-FND-1, R-FND-2)
  - [ ] 1.1 `package.json` (name `tag-registry-client`, same devDependency versions as the scheduler repo, scripts per tech.md), `tsconfig.json`, `jest.config.js`, `esbuild.config.mjs`, `.gitignore` (`main.js`, `node_modules`, `.deploy.json`).
  - [ ] 1.2 `manifest.json`, `versions.json`, `LICENSE` (MIT), empty `styles.css`.
  - [ ] 1.3 Smoke test: `npm install && npm test && npm run build` on an empty `src/main.ts` + trivial test.
- [ ] 2. Purity guard test (R-FND-2.3)
- [ ] 3. `src/brand.ts` and `src/main.ts` skeleton (R-FND-3); plugin loads in a throwaway vault via `npm run deploy`.
- [ ] 4. Scripts and CI (R-FND-6)
  - [ ] 4.1 Port `scripts/{release,ship,tag-release,deploy}.mjs`; replace plugin dir name; dry-run `release --bump-only` in a scratch clone.
  - [ ] 4.2 `.github/workflows/ci.yml`, `release.yml`; `.github/ISSUE_TEMPLATE/{bug,feature}.yml`; `CODEOWNERS`.
- [ ] 5. Settings persistence (R-FND-4) — covered by registry-subscription task 3; here add test that foreign keys (e.g. `jobs`, `tagReview`, `executor`) are ignored.
- [ ] 6. Diagnostics (R-FND-5)
  - [ ] 6.1 Port `core/diagnostics.ts` + test, cut to the new snapshot shape; sentinel-value leak test.
  - [ ] 6.2 "Report an issue" button in settings (copy + open issue URL).
- [ ] 7. Docs (R-FND-7): README, CLAUDE.md, CONTRIBUTING.md.
- [ ] 8. First release `0.1.0` via `npm run ship`; install from the GitHub release into a clean vault.
