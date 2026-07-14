#!/usr/bin/env bash
# Mechanical (non-LLM) fact-checks between docs/SDK-GUIDE.md / CHANGELOG.md /
# the gate definition and the actual repo files. Pure grep/sed, no node, no
# network — adapted from otpless-headless-android-lite's
# scripts/docs-verify.sh. Each check prints PASS/FAIL; the script exits
# non-zero if any check fails. Run from the repo root.
#
# Required by the docs-sync skill and the docs-verify CI workflow.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

GUIDE="docs/SDK-GUIDE.md"
CHANGELOG="CHANGELOG.md"
PACKAGE_JSON="package.json"
ANDROID_BUILD_GRADLE="android/build.gradle"
PODSPEC="otpless-headless-rn.podspec"
MAKEFILE="Makefile"
CLAUDE_MD="CLAUDE.md"
VERIFY_SKILL=".claude/skills/verify/SKILL.md"
BUILD_TEST_WORKFLOW=".github/workflows/build-test.yml"

EXIT_CODE=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; EXIT_CODE=1; }

# ---------------------------------------------------------------------------
# 0. Required files exist. docs/SDK-GUIDE.md is produced by a separate PR
#    (feat/sdk-guide) — if it hasn't landed yet on this branch, skip the
#    guide-dependent checks (1, 2, 3) rather than failing the whole script,
#    but still run the checks that don't need it (4, 5, 6).
# ---------------------------------------------------------------------------
GUIDE_PRESENT=1
if [ ! -f "$GUIDE" ]; then
  GUIDE_PRESENT=0
  echo "SKIP: $GUIDE not present yet in this checkout (guide ships in a separate PR) — skipping guide-dependent checks 1-3."
fi

for f in "$CHANGELOG" "$PACKAGE_JSON" "$ANDROID_BUILD_GRADLE" "$PODSPEC" "$MAKEFILE"; do
  if [ ! -f "$f" ]; then
    fail "required file missing: $f"
  fi
done
if [ "$EXIT_CODE" -ne 0 ]; then
  echo "Aborting: required files missing."
  exit "$EXIT_CODE"
fi

PACKAGE_VERSION=$(grep -m1 '"version"' "$PACKAGE_JSON" | sed -E 's/.*"version": *"([^"]*)".*/\1/')
ANDROID_PIN=$(grep -oE 'io\.github\.otpless-tech:otpless-headless-sdk:[0-9A-Za-z._-]+' "$ANDROID_BUILD_GRADLE" | head -1)
IOS_PIN=$(grep -oE "s\.dependency 'OtplessBM/Core', *'[0-9A-Za-z._-]+'" "$PODSPEC" | head -1 | sed -E "s/.*'([0-9A-Za-z._-]+)'\$/\1/")

# ---------------------------------------------------------------------------
# 1. Guide's declared package version matches package.json.
# ---------------------------------------------------------------------------
if [ "$GUIDE_PRESENT" -eq 1 ]; then
  GUIDE_VERSION=$(grep -o 'package version \*\*[^*]*\*\*' "$GUIDE" | head -1 | sed -E 's/.*\*\*([^*]*)\*\*/\1/')
  if [ -z "$GUIDE_VERSION" ]; then
    fail "could not find 'package version **X**' line in $GUIDE"
  elif [ "$GUIDE_VERSION" = "$PACKAGE_VERSION" ]; then
    pass "guide-declared package version ($GUIDE_VERSION) matches package.json ($PACKAGE_VERSION)"
  else
    fail "guide-declared package version ($GUIDE_VERSION) != package.json version ($PACKAGE_VERSION)"
  fi
fi

# ---------------------------------------------------------------------------
# 2. Guide's declared Android native pin matches android/build.gradle.
# ---------------------------------------------------------------------------
if [ "$GUIDE_PRESENT" -eq 1 ]; then
  if [ -z "$ANDROID_PIN" ]; then
    fail "could not find otpless-headless-sdk pin in $ANDROID_BUILD_GRADLE"
  elif grep -qF "$ANDROID_PIN" "$GUIDE"; then
    pass "Android native pin ($ANDROID_PIN) present in guide"
  else
    fail "Android native pin ($ANDROID_PIN, from $ANDROID_BUILD_GRADLE) missing from guide"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Guide's declared iOS native pin matches the podspec.
# ---------------------------------------------------------------------------
if [ "$GUIDE_PRESENT" -eq 1 ]; then
  if [ -z "$IOS_PIN" ]; then
    fail "could not find OtplessBM/Core dependency version in $PODSPEC"
  elif grep -qF "$IOS_PIN" "$GUIDE"; then
    pass "iOS native pin ($IOS_PIN) present in guide"
  else
    fail "iOS native pin ($IOS_PIN, from $PODSPEC) missing from guide"
  fi
fi

# ---------------------------------------------------------------------------
# 4. CHANGELOG.md has a heading for the current package.json version, or an
#    Unreleased section.
# ---------------------------------------------------------------------------
if [ -z "$PACKAGE_VERSION" ]; then
  fail "cannot check CHANGELOG heading — package.json version unknown"
else
  ESCAPED_VERSION=$(printf '%s' "$PACKAGE_VERSION" | sed -E 's/\./\\./g')
  if grep -qE "^## ${ESCAPED_VERSION} " "$CHANGELOG" || grep -qE '^## Unreleased' "$CHANGELOG"; then
    pass "CHANGELOG.md has a heading for $PACKAGE_VERSION or an Unreleased section"
  else
    fail "CHANGELOG.md has neither a '## $PACKAGE_VERSION' heading nor '## Unreleased'"
  fi
fi

# ---------------------------------------------------------------------------
# 5. CHANGELOG.md must not regress the latest released version vs. what's
#    already on origin/main (never rewrite/remove a released heading).
# ---------------------------------------------------------------------------
if git rev-parse --verify origin/main >/dev/null 2>&1 && git cat-file -e "origin/main:$CHANGELOG" 2>/dev/null; then
  PREV_VERSIONS=$(git show "origin/main:$CHANGELOG" 2>/dev/null | grep -oE '^## [0-9][0-9A-Za-z._-]*' | sed -E 's/^## //')
  MISSING=""
  for v in $PREV_VERSIONS; do
    ESCAPED_V=$(printf '%s' "$v" | sed -E 's/\./\\./g')
    if ! grep -qE "^## ${ESCAPED_V}([^0-9A-Za-z._-]|\$)" "$CHANGELOG"; then
      MISSING="$MISSING $v"
    fi
  done
  if [ -z "$MISSING" ]; then
    pass "no previously released CHANGELOG.md version heading was removed"
  else
    fail "previously released CHANGELOG.md version heading(s) missing (history must never be rewritten):$MISSING"
  fi
else
  echo "SKIP: no origin/main CHANGELOG.md to diff against (fresh repo or no network) — skipping check 5."
fi

# ---------------------------------------------------------------------------
# 6. Gate composition drift: the command list Makefile's `gate` target runs
#    must be the one restated in CLAUDE.md and in the build-test CI workflow
#    (CLAUDE.md's own gate command line, and build-test.yml's `make gate`
#    invocation). This is the same idea as lite's docs-verify.sh check 6 —
#    catch the gate silently growing a step that the docs/CI don't know
#    about, or vice versa.
# ---------------------------------------------------------------------------
if [ -f "$MAKEFILE" ]; then
  GATE_DEPS=$(grep -E '^gate:' "$MAKEFILE" | head -1 | sed -E 's/^gate: *//')
  if [ -z "$GATE_DEPS" ]; then
    fail "Makefile has no 'gate:' target (or it declares no prerequisites) — expected 'gate: install typecheck lint test ts-surface docs-verify' or similar"
  else
    pass "Makefile 'gate' target found with prerequisites: $GATE_DEPS"
    if [ -f "$CLAUDE_MD" ] && ! grep -qF "make gate" "$CLAUDE_MD"; then
      fail "$CLAUDE_MD never mentions 'make gate' — restate the canonical gate command there"
    fi
    if [ -f "$VERIFY_SKILL" ] && ! grep -qF "make gate" "$VERIFY_SKILL"; then
      fail "$VERIFY_SKILL never mentions 'make gate' — the verify ladder must point at the canonical gate"
    fi
    if [ -f "$BUILD_TEST_WORKFLOW" ] && ! grep -qF "make gate" "$BUILD_TEST_WORKFLOW"; then
      fail "$BUILD_TEST_WORKFLOW never runs 'make gate' — CI must run the same canonical gate, not a hand-restated subset"
    fi
  fi
else
  fail "$MAKEFILE missing"
fi

exit "$EXIT_CODE"
