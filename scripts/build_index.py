#!/usr/bin/env python3
"""Build the browser search index from a JSON guide manifest.

Manifest rows require: guide, market, pdf_url.  The script downloads each PDF,
extracts text per page, and writes one location for every model-like code.  It
does not expose prices; capture those columns later in a separate data pass.
"""
import argparse, json, re
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen
from pypdf import PdfReader

MODEL = re.compile(r"\b[A-Z]{1,7}[A-Z0-9]*(?:[-_ ][A-Z0-9.]+){1,}\b")

def download(url, path):
    request = Request(url, headers={"User-Agent": "KrugGuideFinder/0.1 (authorized Krug indexer)"})
    with urlopen(request, timeout=180) as response, path.open("wb") as output:
        while chunk := response.read(1024 * 1024): output.write(chunk)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/search-index.json"))
    parser.add_argument("--cache", type=Path, default=Path(".guide-cache"))
    args = parser.parse_args(); args.cache.mkdir(exist_ok=True)
    records = []
    for guide in json.loads(args.manifest.read_text())["guides"]:
        pdf = args.cache / (re.sub(r"[^A-Za-z0-9]+", "_", guide["guide"]) + ".pdf")
        if not pdf.exists(): download(guide["pdf_url"], pdf)
        reader = PdfReader(str(pdf))
        for number, page in enumerate(reader.pages, start=1):
            for model in set(MODEL.findall(page.extract_text() or "")):
                records.append({"model": model, "guide": guide["guide"], "market": guide["market"], "page": number, "url": guide["pdf_url"]})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"updated": date.today().strftime("%B %-d, %Y"), "records": records}, indent=2) + "\n")
    print(f"Wrote {len(records)} locations to {args.output}")

if __name__ == "__main__": main()
