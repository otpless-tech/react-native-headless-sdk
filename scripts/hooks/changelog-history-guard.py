#!/usr/bin/env python3
"""PostToolUse hook: warn when an edit reaches into already-released
CHANGELOG.md sections.

CLAUDE.md / docs-sync rule: never rewrite history for already-released
versions — only append under `## Unreleased` (or promote it to a new version
heading on release). This guard makes that invariant mechanical.

Ported from otpless-headless-android-lite's scripts/hooks/changelog-history-
guard.py — logic is repo-agnostic (it only looks at CHANGELOG.md's own `##`
heading structure), so nothing needed to change for this repo.

Reads the Claude Code hook JSON on stdin; exits 2 (warn) with a stderr
message when the working-tree diff of CHANGELOG.md touches a released
section. Release-promotion is allowed for: when no `## Unreleased` heading
exists (it was just renamed to a version heading), the topmost released
section is treated as still-being-written and protection starts at the
second one.
"""
import json
import os
import re
import subprocess
import sys


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0

    fp = (data.get("tool_input") or {}).get("file_path") or ""
    if not fp:
        return 0
    root = os.getcwd()
    changelog = os.path.join(root, "CHANGELOG.md")
    if os.path.isabs(fp):
        if os.path.realpath(fp) != os.path.realpath(changelog):
            return 0
    elif fp != "CHANGELOG.md":
        return 0

    try:
        with open(changelog, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except OSError:
        return 0

    released = [i + 1 for i, line in enumerate(lines) if re.match(r"^## [0-9]", line)]
    has_unreleased = any(re.match(r"^## Unreleased", line) for line in lines)
    if not released:
        return 0
    if has_unreleased:
        protected_start = released[0]
    elif len(released) > 1:
        protected_start = released[1]
    else:
        return 0

    try:
        diff = subprocess.run(
            ["git", "diff", "-U0", "--", "CHANGELOG.md"],
            capture_output=True, text=True, cwd=root, timeout=15,
        ).stdout
    except Exception:
        return 0

    for m in re.finditer(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", diff, re.M):
        start = int(m.group(1))
        count = int(m.group(2)) if m.group(2) is not None else 1
        end = start + max(count, 1) - 1
        if end >= protected_start:
            sys.stderr.write(
                "CHANGELOG.md: the working-tree diff reaches into an already-released "
                f"section (line {protected_start} onward). Released history must never "
                "be rewritten (CLAUDE.md / docs-sync rule) — only append under "
                "'## Unreleased' or promote it to a new version heading on release. "
                "Proceed only if the user explicitly asked for this historical "
                "correction.\n"
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
