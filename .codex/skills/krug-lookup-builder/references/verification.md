# Verification and QA

Read this reference for implementation, defect fixes, data changes, QA, and release review. Adapt commands and tools to the actual project rather than assuming a framework.

## Minimum verification by change type

### Product data

- Validate required fields, identifiers, duplicates, provenance, and referential integrity.
- Compare import counts and conflict reports with the source material.
- Spot-check records across different collections and model patterns.
- Confirm a repeated import does not create unintended duplicates.

### Lookup behavior

Cover representative cases for:

- exact known identifiers;
- confirmed case, space, or punctuation variants;
- incomplete identifiers;
- ambiguous identifiers with multiple plausible candidates;
- invalid and malformed input;
- identifiers that differ by one meaningful character;
- discontinued or legacy records only when authoritative status data exists;
- empty input and unusually long input;
- regression examples for every corrected defect.

Assert match classification and ordering, not only whether some result exists.

### Interface

- Verify keyboard operation, visible focus, accessible names, heading order, status/error announcements, contrast, and zoom behavior.
- Check empty, loading, no-result, ambiguous-result, error, and successful-result states.
- Check narrow mobile and ordinary desktop layouts.
- Confirm long model numbers, product names, and source labels wrap without hiding actions or facts.
- Ensure suggestions cannot be mistaken for verified exact matches.

### Engineering

- Run the project's formatter, type checker, linter, unit tests, integration tests, and build where applicable.
- Prefer focused diagnostics while iterating, followed by the broadest relevant checks before completion.
- Do not repair unrelated failures without permission. Separate pre-existing failures from regressions caused by the change.

## Independent review

For substantial changes, a reviewer that did not implement the feature should inspect the diff and try adversarial queries. Its job is to find unsupported assumptions, false-positive matches, hidden ambiguity, accessibility problems, missing tests, and unintended changes. The lead agent decides and integrates fixes, then reruns verification.

## Handoff

Report:

- behavior added or corrected;
- data sources used and any unresolved conflicts;
- tests and visual checks run, including failures;
- assumptions that remain unverified;
- changed files and any manual follow-up needed.

Do not use “fully verified,” “authoritative,” or equivalent language unless both the implementation and underlying product data support that claim.
