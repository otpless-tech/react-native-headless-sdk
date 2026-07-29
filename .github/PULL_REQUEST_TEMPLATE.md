## What & why

<!-- What does this PR change, and why? Link an issue if one exists. -->

## Constitution checklist

<!-- See CLAUDE.md's "Wrapper development constitution" for the full rules behind each item. -->

- [ ] No public-TS-surface / response-envelope change, or `api/*.d.ts` golden refresh
      (`scripts/check-ts-surface.sh --update`) + contract fixture + this repo's Atlas page +
      `CHANGELOG.md` updated, and `react-native-headless-lite` parity checked
- [ ] `make gate` passes (paste actual output, not "should pass")
- [ ] If `android/**` or `ios/**` changed: stated plainly which native files, and whether
      hand-verified against `example/` or explicitly flagged as not possible in this environment
      (`make gate` does not compile or test native code — see the verify skill)
- [ ] No new bridge-level data collection, or documented in `CLAUDE.md` article 3 + this repo's
      Atlas page in this same PR
- [ ] `CHANGELOG.md` `## Unreleased` entry added
- [ ] Doesn't silently reintroduce a known quirk listed on the Atlas page (see the pr-review skill)
- [ ] The `atlas-docs` CI job is green — docs live in `otpless-tech/atlas`, not in this repo

## Parity statement

<!-- Native-sdks hub rule: does this PR touch a concept shared with react-native-headless-lite (the
     start() request shape, the OTPlessEventResult envelope, initialize/commitResponse/cleanup
     naming)? State one of: -->
<!-- Parity: ported in react-native-headless-lite#NN -->
<!-- Parity: N/A — <reason this PR has no lite-wrapper equivalent> -->
<!-- Parity: port ticket <link> -->

## Flows exercised

<!-- List what you actually ran (make gate output, example-app manual smoke, etc.) and how.
     State plainly if a native-toolchain-dependent check wasn't possible in this environment. -->
