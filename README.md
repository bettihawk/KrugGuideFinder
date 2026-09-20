# Krug Guide Finder — prototype

A static, public prototype that locates product models in current Krug price guides. It deliberately returns guide/page locations only; the index schema can later be extended with price data.

## Run locally

From this folder, run any static web server. For example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Populate the full catalogue

Refresh the current public guide list before an indexing run:

```sh
python3 scripts/sync_public_catalog.py
```

This writes `data/guide-manifest.json`, which is the live, market-labelled catalogue used by the site. It removes duplicates, canonicalizes the four markets (`US`, `Canada`, `GSA`, and `Vizient`), and refuses WordPress tombstone (`__trashed`) links. Run it whenever Krug updates the Literature page and review the added/removed links before publishing.

Each guide can contain either a direct `pdf_url`, a public Krug download-page `url`, or both:

```json
{"guides":[{"guide":"Seating US Price Guide 2026","market":"US","url":"https://krug.ca/download/seating-us-price-guide-2026/","pdf_url":"https://krug.ca/downloads/priceguides/Krug_Seating_US_PriceGuide_2026.pdf"}]}
```

Then, using the bundled Python runtime with `pypdf` installed:

```sh
python3 scripts/build_index.py data/guide-manifest.json
```

Normal indexing runs re-download every resolved PDF so a changed guide cannot be hidden by an old cached copy. Use `--reuse-cache` only for an intentional offline or repeatable test run.

When `pdf_url` is absent, the builder resolves exactly one PDF from the Krug download page; ambiguous pages must be reviewed and given an explicit `pdf_url`. The script keeps source PDFs in `.guide-cache/`, produces deterministic model-location records, preserves the existing hand-curated `keyword_records`, and writes `data/search-index.json`. A printed `guide_page` is stored only when it is found in the PDF text; otherwise it remains `null` rather than incorrectly copying the physical `pdf_page`.

Validate all checked-in data and run the offline test suite before publishing:

```sh
python3 scripts/validate_data.py
python3 -m unittest discover -s tests -v
```

The public guide catalogue is substantially broader than the verified page-level index. Full model/page extraction remains incomplete, and keyword/category records remain curated evidence rather than inferred pricing equivalence. A production refresh should run on a schedule, report PDFs with no extractable text, compare manifest changes for human review, and publish only after validation succeeds.

## Matching safeguards

`data/matching-rules.json` contains deliberately narrow product-aware aliases and caution notes. It is not a general-purpose autocorrect list: rules that affect configuration or price are labelled **review required**, and ambiguous or distinct models are held in `review_only`. `data/acceptance-fixtures.json` records the real-world inputs supplied by the Krug team and should be expanded whenever a rule is added.

Searches may also use short product-family or guide-name prefixes of two or more characters. These are displayed as possible related results, never as exact configuration matches. Exact models and curated caution rules continue to take precedence.

Compact codes such as `KAR218` are accepted by the extractor only when they contain a plausible 2–7 letter family prefix plus digits and are 5–32 characters long. A one-letter family such as `V2` is accepted only when the extracted model contains a separator, which reduces false positives. Punctuation and case may be normalized for lookup, but option-bearing segments and numeric sizes are never freely corrected. In particular, Karma B/S frame-colour inputs resolve only to the base model and never to the polished-chrome C model; `JD1321N` and `JD1SS1321N` remain distinct.

## Prototype evidence

The initial data contains a verified Karma Commercial US guide location (page 8) and the same model in the general Seating US guide (page 118). The product in the current guide is `KAR2C-26L_U_D`; an incomplete or legacy-style Karma entry will surface as a clearly labelled similar configuration rather than as an exact match.

Each result opens an in-app PDF.js viewer at the indexed physical PDF page. This avoids browser PDF extensions that ignore the normal `#page=` fragment; a secondary Original PDF link remains available.

The index stores both `guide_page` (the printed page label in Krug's guide) and `pdf_page` (the physical page used by a PDF viewer). Results show the printed guide page; the viewer uses the physical PDF page behind the scenes and identifies both values in its header.

`keyword_records` adds a separate, curated product-category index. A plain-language input such as `Faeron metal lounge chair` matches these terms and returns relevant model configurations with their guide locations. During full-guide ingestion, this category index should be reviewed by the Krug team rather than inferred solely from raw model codes.
