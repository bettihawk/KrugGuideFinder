# Krug Guide Finder — prototype

A static, public prototype that locates product models in current Krug price guides. It deliberately returns guide/page locations only; the index schema can later be extended with price data.

## Run locally

From this folder, run any static web server. For example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Populate the full catalogue

Create `guide-manifest.json` containing the public PDF URLs:

```json
{"guides":[{"guide":"Seating US Price Guide 2026","market":"US","pdf_url":"https://krug.ca/downloads/priceguides/Krug_Seating_US_PriceGuide_2026.pdf"}]}
```

Then, using the bundled Python runtime with `pypdf` installed:

```sh
python3 scripts/build_index.py guide-manifest.json
```

The script keeps source PDFs in `.guide-cache/` and writes `data/search-index.json`. The production refresh should retain the manifest, run on a schedule, report PDFs that have no extractable text, and publish only after a validation check.

## Matching safeguards

`data/matching-rules.json` contains deliberately narrow product-aware aliases and caution notes. It is not a general-purpose autocorrect list: rules that affect configuration or price are labelled **review required**, and ambiguous or distinct models are held in `review_only`. `data/acceptance-fixtures.json` records the real-world inputs supplied by the Krug team and should be expanded whenever a rule is added.

## Prototype evidence

The initial data contains a verified Karma Commercial US guide location (page 8) and the same model in the general Seating US guide (page 118). The product in the current guide is `KAR2C-26L_U_D`; an incomplete or legacy-style Karma entry will surface as a clearly labelled similar configuration rather than as an exact match.

Each result opens an in-app PDF.js viewer at the indexed physical PDF page. This avoids browser PDF extensions that ignore the normal `#page=` fragment; a secondary Original PDF link remains available.

The index stores both `guide_page` (the printed page label in Krug's guide) and `pdf_page` (the physical page used by a PDF viewer). Results show the printed guide page; the viewer uses the physical PDF page behind the scenes and identifies both values in its header.
