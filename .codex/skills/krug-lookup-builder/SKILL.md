---
name: krug-lookup-builder
description: Build, modify, audit, or test the Krug furniture model lookup application. Use for work on the Krug Lookup App, including its product data, model-number matching, search results, interface, and release readiness; do not use for unrelated Krug marketing or general furniture research.
---

# Krug Lookup Builder

Help the user maintain a reliable lookup tool that turns Krug model-number input into accurate, understandable product matches. Treat the current project and approved Krug materials as authoritative; the skill supplies the workflow, not product facts.

## Start from the active project

1. Inspect applicable `AGENTS.md` files, project documentation, package manifests, data files, search code, tests, and the current UI before proposing or making changes.
2. Preserve the existing architecture and visual system unless the user asks for a redesign or a demonstrated problem requires a focused change.
3. Check the working tree before editing. Preserve user changes and avoid unrelated rewrites.
4. If the project, required source data, or requested target is unavailable, state exactly what is missing and request the smallest useful input. Do not reconstruct the app from memory.

Read [references/product-data-and-matching.md](references/product-data-and-matching.md) whenever the task changes product records, imports, model-number parsing, matching, or result ranking.

Read [references/verification.md](references/verification.md) whenever implementing a feature, fixing a defect, changing data or lookup behavior, reviewing release readiness, or performing QA.

## Establish the task boundary

Classify the request before acting:

- **Data work:** importing, correcting, validating, or extending Krug product information.
- **Lookup work:** normalization, parsing, matching, ranking, ambiguity handling, or no-result behavior.
- **Interface work:** search entry, filters, result cards, product details, feature imagery, accessibility, or responsive behavior.
- **Engineering work:** architecture, storage, APIs, performance, dependencies, deployment, or maintenance.
- **Audit work:** code review, data-quality review, UX review, accessibility checks, or test planning.

Follow explicit user instructions over this skill. Do not expand a targeted request into a redesign, data migration, dependency upgrade, deployment, or external write without authorization.

## Protect factual accuracy

- Never invent a Krug collection, model, model-number segment, feature, dimension, finish, option, compatibility rule, availability state, or discontinuation status.
- Preserve source values separately from normalized search values. Normalization may improve matching but must not silently rewrite authoritative identifiers.
- Keep evidence or provenance available for imported and corrected records when the project schema supports it.
- Treat inferred patterns as hypotheses until confirmed by approved source material or the user. Do not persist a hypothesis as fact.
- Present uncertain or ambiguous matches as candidates. Do not turn fuzzy similarity into an exact identification.
- Preserve existing Krug branding. The available working brand reference identifies **Alverata Informal Bold** for display/headings; use it only when the project already has a properly available font asset or approved loading method. Do not invent unconfirmed colours, logo rules, or brand standards.

## Implement deliberately

1. Trace the relevant data and code path before editing.
2. State the intended behavior and important edge cases in compact terms.
3. Make the smallest coherent change that fully satisfies the request.
4. Keep source data, lookup logic, and presentation concerns separate where the existing architecture permits.
5. Add or update meaningful tests alongside behavioral changes.
6. Run focused checks first, then the broader relevant suite.
7. Visually inspect user-facing changes at representative desktop and mobile sizes when preview capability is available.
8. Summarize the outcome, verification performed, assumptions, unresolved data questions, and changed files.

## Use subagents for substantial parallel work

For a sizeable request with independent workstreams, delegate only when subagents are available and authorized. Keep one lead responsible for decisions and integration. Suitable bounded assignments include:

- mapping data sources and schema issues;
- tracing lookup and ranking behavior;
- reviewing the interface and accessibility;
- producing adversarial test cases;
- independently reviewing an integrated change.

Give each subagent a non-overlapping scope and prohibit unrelated edits. Do not have multiple agents edit the same core files concurrently. The lead must reconcile disagreements, inspect all changes, and run final verification. Small fixes and tightly coupled changes should remain with one agent.

## Completion standard

A task is complete only when the requested behavior is implemented or the requested analysis is delivered, factual claims remain grounded, applicable tests pass, user-facing changes have been inspected when feasible, and remaining uncertainty is explicit. Never claim that a model lookup is authoritative when its underlying source is missing or unverified.
