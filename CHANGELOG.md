# Changelog — otpless-headless-rn

npm package: `otpless-headless-rn`
Bridges: Android (`io.github.otpless-tech:otpless-headless-sdk`) + iOS (`OtplessBM`)

This file is the human/agent-curated, merchant-facing record of changes. It is **complementary
to, not a replacement for**, `release-it`'s `@release-it/conventional-changelog` automation
(configured in `package.json` → `release-it`), which generates GitHub Release notes from Angular-
preset commit messages at publish time. That automation reads commit history; this file is
curated by whoever lands the PR, so it can say things like "why" and "merchant-visible or not"
that a commit-message-derived changelog can't. Keep both — see the **release** skill.

This changelog starts fresh at the current published version, **2.2.0**; there is no earlier
history to backfill. Going forward: accumulate bullets under `## Unreleased` (one per merged PR),
and promote it to a versioned heading on release per the **release** skill.

## Unreleased

**Repo & tooling** (no merchant-visible change — internal AI-agent-readiness scaffolding)

- Fixed `package.json`'s `packageManager` field: `"^yarn@1.22.15"` → `"yarn@1.22.15"`. The caret
  range is not a valid Corepack package-manager specifier (Corepack requires an exact version) —
  Corepack-shimmed `yarn` (the modern Node default) failed immediately with `Unsupported package
  manager specification` before attempting any install. Classic Yarn ignored the field, so CI
  (which installs via `actions/setup-node` without enabling Corepack) was unaffected, but any
  contributor or agent on a Corepack-managed Node install hit a wall on step one.
- Un-ignored `CLAUDE.md` and `AGENTS.md` in `.gitignore` (they were bare-listed at the end,
  silently git-ignoring any file of that name added at the repo root) and added `coverage/`
  (Jest's `--coverage` output was untracked cruft and, worse, was being picked up by the `eslint`
  glob before this fix, producing spurious lint findings against generated report JS).
- Added `CLAUDE.md` (repo constitution: public-API-as-TS-surface contract, host-app-safety rules,
  privacy/data-collection statement, naming, dependency/size conservatism, verification-before-
  merge), a root `Makefile` with a canonical `gate` target, and `.claude/skills/{verify,
  docs-sync,add-tests,pr-review,release,size-review,bump-native-sdk}/SKILL.md`.
- Added `api/index.d.ts` + `api/models.d.ts` as the committed public-TS-surface golden, and
  `scripts/check-ts-surface.sh` (`yarn prepack` + declaration-emit diff, `--update` mode) to
  detect drift mechanically.
- Added `scripts/docs-verify.sh` (mechanical fact-check: guide-vs-code native pins and package
  version, CHANGELOG heading/history, gate-composition drift across CLAUDE.md / the verify skill
  / CI).
- Added a Jest coverage ratchet (`package.json` → `jest.coverageThreshold`) pinned at the measured
  baseline (statements 24%, branches 33.33%, functions 14.28%, lines 24% — `src/index.tsx` only;
  `src/models.tsx` is pure type declarations with no runtime code, hence 0% is not a real gap).
- Added a response-envelope contract fixture (`src/__tests__/__fixtures__/contract/
  envelope_shape.json`) and a Jest test asserting its key set matches the verbatim
  `{responseType, response, statusCode}` envelope documented in `docs/SDK-GUIDE.md` §7. Scope,
  stated honestly: this guards doc/fixture drift only — 100% of the actual marshalling logic is
  Kotlin/Swift, which Jest cannot execute, so this is not a substitute for a native bridge test.
- Ran `eslint --fix` once as a mechanical, no-behavior-change cleanup: fixed all 301 pre-existing
  `prettier/prettier` errors (all whitespace/formatting — `src/models.tsx` plus incidental
  formatting drift in `example/`). The remaining 13 warnings (`react-native/no-inline-styles`,
  `eqeqeq`, `@typescript-eslint/no-shadow`, all in `example/`, the sample app testbed) are left
  as-is: they are warnings, not errors (`yarn lint` exits 0), and `example/` is out of scope for
  behavioral edits per this repo's "never refactor the testbed" rule.
- Added `.claude/settings.json` hooks: block edits to `example/` (testbed) and to the generated
  goldens (`api/*.d.ts`, the contract fixture) in favor of their update scripts/tests, warn on
  contract-adjacent edits (`src/index.tsx`, `src/models.tsx`, the fixtures directory), a
  CHANGELOG released-history guard, a read-only Bash allowlist, and a deny on `git push origin
  main`.
- Replaced `.github/workflows/ci.yml` with `.github/workflows/build-test.yml` (`make gate` +
  `actionlint`); added `.github/workflows/docs-verify.yml` and `.github/workflows/docs-sync.yml`
  (opens a docs PR on merge to `main`, mirroring the android-lite pattern); added
  `.github/workflows/claude.yml` for `@claude` PR/issue mentions. Updated `.github/dependabot.yml`
  to cover `npm` + `github-actions` (this repo has no Gradle ecosystem to manage).
- Added `.github/PULL_REQUEST_TEMPLATE.md` with a constitution checklist and a parity-statement
  line (native-sdks hub rule: phone-auth-affecting changes should note their `otpless-rn-lite`
  parity status).
- Added `docs/.doc-sync-state` (currently stamped to the commit the `feat/sdk-guide` PR's
  `docs/SDK-GUIDE.md` was written against — `a77ac7e6662fec92966e74f9c62053c0b3149095` — since that
  guide PR has not merged yet; whichever PR merges the guide should re-stamp this to its own HEAD).
