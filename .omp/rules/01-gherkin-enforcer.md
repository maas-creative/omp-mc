---
description: Enforce BDD/Gherkin specifications before implementation
triggers:
  - "(?i)edit"
  - "(?i)write"
  - "(?i)create"
  - "(?i)implement"
---

# Absolute Gherkin Specification Requirement

Before writing any implementation code, you MUST verify:

1. A `.feature` file (Gherkin format) exists under `features/` for the target behavior.
2. If it does not exist, you MUST NOT start writing code.
3. Create the Gherkin specification (`Feature`, `Scenario`, `Given`, `When`, `Then`) first.

This rule is absolute. "This is a simple fix" is NOT a valid reason to skip it.
