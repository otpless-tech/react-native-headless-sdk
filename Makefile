.PHONY: install typecheck lint test ts-surface docs-verify gate clean

YARN := yarn

# `gate` is the single source of truth for full verification of this repo —
# CLAUDE.md, the verify skill, and .github/workflows/build-test.yml all
# restate this same command list; scripts/docs-verify.sh check 6 fails if
# they drift from what's declared here.
gate: install typecheck lint test ts-surface docs-verify
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

# Mechanical (non-LLM) doc/changelog fact-check — see scripts/docs-verify.sh.
docs-verify:
	bash scripts/docs-verify.sh

clean:
	$(YARN) clean
	rm -rf lib coverage
