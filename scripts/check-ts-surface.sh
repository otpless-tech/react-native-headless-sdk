#!/usr/bin/env bash
# Diffs the freshly built public TypeScript declaration files against the
# committed golden in api/{index,models}.d.ts. This is the mechanical
# public-API-surface contract for this npm package — the equivalent of
# otpless-headless-android-lite's `scripts/check-shipped-surface.sh` (which
# diffs a post-R8 decompiled Android surface) adapted to a TS declaration
# emit diff, since there is no shrinker step here.
#
# `api/index.d.ts` + `api/models.d.ts` together ARE the complete public TS
# surface (src/index.tsx re-exports everything from src/models.tsx, so those
# two files are the whole story — see CLAUDE.md and this repo's Atlas page).
#
# Usage:
#   bash scripts/check-ts-surface.sh            # fail non-zero on drift
#   bash scripts/check-ts-surface.sh --update   # regenerate the golden, then exit 0
#
# Both modes run `yarn prepack` (react-native-builder-bob), which emits
# lib/commonjs, lib/module, and lib/typescript from src/. Only lib/typescript
# is relevant here.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-check}"

echo "Running 'yarn prepack' to generate fresh declarations..."
yarn prepack >/tmp/check-ts-surface-prepack.log 2>&1 || {
  echo "FAIL: yarn prepack failed. Log:"
  cat /tmp/check-ts-surface-prepack.log
  exit 1
}

FRESH_INDEX="lib/typescript/index.d.ts"
FRESH_MODELS="lib/typescript/models.d.ts"

for f in "$FRESH_INDEX" "$FRESH_MODELS"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: expected declaration file missing after prepack: $f"
    exit 1
  fi
done

# Strip the trailing `//# sourceMappingURL=...` line — it's a build-path
# artifact, not part of the public surface — before comparing or updating.
strip_map_comment() {
  sed '/\/\/# sourceMappingURL=/d' "$1"
}

if [ "$MODE" = "--update" ]; then
  strip_map_comment "$FRESH_INDEX" >api/index.d.ts
  strip_map_comment "$FRESH_MODELS" >api/models.d.ts
  echo "Updated api/index.d.ts and api/models.d.ts from the current build."
  exit 0
fi

EXIT_CODE=0

diff_one() {
  local golden="$1" fresh="$2" label="$3"
  if [ ! -f "$golden" ]; then
    echo "FAIL: golden $golden does not exist. Run 'bash scripts/check-ts-surface.sh --update' and review the diff."
    EXIT_CODE=1
    return
  fi
  if diff -u "$golden" <(strip_map_comment "$fresh") >/tmp/check-ts-surface-diff-"$label".txt; then
    echo "PASS: $label surface matches $golden"
  else
    echo "FAIL: $label surface drifted from $golden"
    echo "--- diff ($golden vs freshly built $fresh) ---"
    cat /tmp/check-ts-surface-diff-"$label".txt
    EXIT_CODE=1
  fi
}

diff_one "api/index.d.ts" "$FRESH_INDEX" "index"
diff_one "api/models.d.ts" "$FRESH_MODELS" "models"

if [ "$EXIT_CODE" -ne 0 ]; then
  echo
  echo "Public TS surface drifted from the committed golden (api/index.d.ts / api/models.d.ts)."
  echo "If this change is intentional: review the diff above against CLAUDE.md constitution"
  echo "article 1 (semver discipline, additive evolution, breaking-change changelog entry),"
  echo "then run 'bash scripts/check-ts-surface.sh --update' and commit the refreshed goldens."
fi

exit "$EXIT_CODE"
