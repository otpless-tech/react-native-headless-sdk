.PHONY: install typecheck lint test ts-surface gate clean

YARN := yarn

# `gate` is the single source of truth for full verification of this repo —
# CLAUDE.md, the verify skill, and .github/workflows/build-test.yml all
# restate this same command list.
#
# The gate is source-side only. Documentation freshness is deliberately NOT
# checked here: platform docs live in otpless-tech/atlas, this repo has no
# docs/ directory, and a local gate has no Atlas checkout to diff against.
# That check runs as the `atlas-docs` workflow on every PR instead.
gate: install typecheck lint test ts-surface
	@echo "gate: all checks passed."

install:
	$(YARN) install --frozen-lockfile

typecheck:
	$(YARN) tsc --noEmit

lint:
	$(YARN) eslint "**/*.{js,ts,tsx}"

# Runs the unit tests + the response-envelope contract-fixture test (both
# live under src/__tests__/) with the coverage ratchet enforced via the
# jest.coverageThreshold in package.json — no separate coverage step.
test:
	$(YARN) jest --coverage

# Public TS surface golden — see scripts/check-ts-surface.sh.
ts-surface:
	bash scripts/check-ts-surface.sh

clean:
	$(YARN) clean
	rm -rf lib coverage
