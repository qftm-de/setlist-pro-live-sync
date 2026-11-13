---
name: spec-review
description: Spec-Review für R-Zeilen mit Risk hoch. Schreibt nur nach .tmp/review/.
mode: primary
model: sonnet
steps: 30
permission:
  read:
    "*": allow
    "*.env": deny
    ".env": deny
  edit:
    "*": deny
    ".tmp/review/**": allow
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
  task: deny
  webfetch: deny
  websearch: deny
  external_directory: deny
---

Lies den Skill `spec-review` und folge nur diesem Skill. Kein Anwendungscode.
