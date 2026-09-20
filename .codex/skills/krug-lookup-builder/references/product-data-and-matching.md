# Product data and model matching

Read this reference for product-record changes, imports, parsing, matching, or ranking.

## Source priority

Use the strongest available source in this order unless the project defines a stricter policy:

1. User-designated authoritative Krug source files or structured datasets.
2. Approved Krug catalogues, price lists, specification sheets, and official product pages.
3. Existing application records with traceable provenance.
4. User-confirmed corrections.

Search snippets, retailer listings, generated images, filenames, and visual resemblance are not sufficient authority for product facts. Use them only to locate stronger evidence or as clearly labeled leads.

When sources conflict, preserve the competing values and their provenance long enough to investigate. Prefer the source that is more authoritative, specific to the relevant market and date, and explicitly applicable to the model. Report unresolved conflicts rather than silently choosing.

## Record handling

- Preserve the raw model number exactly as supplied.
- Store or compute a separate normalized search key.
- Keep collection, base model, configuration/options, market, effective date, status, and source as distinct fields when the available evidence and schema support them.
- Do not infer missing segments merely to satisfy a schema. Use an explicit unknown or null state.
- Validate uniqueness using the project's real identity rules; do not assume a displayed model number is globally unique.
- Make imports repeatable and idempotent when practical. Report inserted, updated, unchanged, rejected, and conflicting records separately.

## Query normalization

Normalization may handle benign input variation such as case, surrounding whitespace, and confirmed punctuation conventions. Preserve the original query for display and diagnostics.

Do not remove, reorder, expand, or reinterpret characters when that could change a model's meaning unless documented Krug rules confirm the transformation. Keep normalization deterministic and covered by tests.

## Match classes

Keep match types visibly distinct:

- **Exact:** raw query matches an authoritative identifier under documented comparison rules.
- **Normalized exact:** only confirmed benign normalization differs.
- **Structured candidate:** confirmed parsing rules identify one or more plausible records, but the input is incomplete.
- **Suggested:** partial or fuzzy similarity proposes possibilities and must not be presented as identification.
- **No verified match:** the available sources do not support a candidate.

For multiple candidates, return enough distinguishing information for a person to choose. Never resolve ambiguity using undocumented assumptions. If the application uses scores, test ordering and thresholds against representative valid, incomplete, malformed, and conflicting inputs.

## Data-change evidence

For each non-trivial correction or new parsing rule, retain the supporting source in the project's established provenance mechanism and add a regression example. If the project has no mechanism, describe the gap before introducing a new one; do not redesign storage during an unrelated fix.
