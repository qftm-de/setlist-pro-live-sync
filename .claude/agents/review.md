---
name: review
description: Reviewt den Diff nach dem Skill. Schreibt nur nach .tmp/review/.
mode: primary
model: sonnet
steps: 60
permission:
  read:
    "*": allow
    "*.env": deny
    ".env": deny
    ".env.*": deny
    "*.env.example": allow
  edit:
    "*": deny
    ".tmp/review/**": allow
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "node scripts/review-constraints.mjs": allow
    "node scripts/lint-colors.mjs": allow
    "node scripts/verify-requirements.mjs --affected": allow
    "node scripts/review-run.mjs*": allow
    "node scripts/review-stand.mjs": allow
  task: deny
  webfetch: deny
  websearch: deny
  external_directory: deny
---

Lies den Skill `review` und folge nur diesem Skill.

Wer reviewt, ändert keinen Code. Schreiben nur nach `.tmp/review/`. Keine Secrets im Bericht. Kein voller Verify, kein `--verify-affected`.
