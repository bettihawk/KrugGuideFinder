#!/usr/bin/env python3
"""Build deterministic model/page records from the public guide manifest.

Curated ``keyword_records`` already present in the output are retained. Unknown
printed page labels remain null; ``pdf_page`` is always the physical PDF page.
"""
import argparse
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

try:
    from .sync_public_catalog import MARKETS, canonical_market, is_tombstone, normalize_guides
except ImportError:
    from sync_public_catalog import MARKETS, canonical_market, is_tombstone, normalize_guides

TOKEN = re.compile(r"(?<![A-Z0-9])[A-Z]{1,7}[A-Z0-9]*(?:[-_.][A-Z0-9.]+)*(?![A-Z0-9])")
PRINTED_PAGE = re.compile(r"\b(?:(\d{1,4})\s*\|\s*(?:USA|US|CANADA|CDN|GSA|VIZIENT)|(?:USA|US|CANADA|CDN|GSA|VIZIENT)\s*\|\s*(\d{1,4}))\b", re.I)
NON_MODEL_PREFIXES = {"PAGE", "GRADE", "OPTION", "YEAR", "USA", "CDN", "GSA"}


def printed_page(text):
    """Return an explicitly printed guide page, never a PDF-page fallback."""
    match = PRINTED_PAGE.search(text or "")
    return int(next(value for value in match.groups() if value)) if match else None


def model_candidates(text):
    """Extract separated and compact codes with conservative product-code guards."""
    found = set()
    for match in TOKEN.finditer(text or ""):
        value = match.group(0).strip("-_.")
        compact = re.sub(r"[-_.]", "", value)
        if not (5 <= len(compact) <= 32 and re.search(r"\d", compact)):
            continue
        if compact.isdigit() or re.fullmatch(r"(?:19|20)\d{2}", compact):
            continue
        prefix_match = re.match(r"[A-Z]+", compact)
        if not prefix_match or not (1 <= len(prefix_match.group(0)) <= 7):
            continue
        prefix = prefix_match.group(0)
        if prefix in NON_MODEL_PREFIXES:
            continue
        # Unpunctuated codes are the noisiest OCR case. Known Krug examples use
        # short family keys (KAR, FAE, JOR, LEY, IP, JD), so cap these at four.
        has_separator = bool(re.search(r"[-_.]", value))
        if len(prefix) == 1 and not has_separator:
            continue
        if not has_separator and len(prefix) > 4:
            continue
        found.add(value)
    return sorted(found)


class PdfLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() != "a":
            return
        href = dict(attrs).get("href", "")
        if urlparse(href).path.casefold().endswith(".pdf"):
            self.urls.append(href)


def resolve_pdf_url(guide, *, opener=urlopen):
    """Return a direct PDF URL from either manifest schema."""
    explicit = str(guide.get("pdf_url") or "").strip()
    landing = str(guide.get("url") or explicit).strip()
    candidate = explicit or landing
    if is_tombstone(candidate):
        raise ValueError(f"refusing tombstone URL for {guide.get('guide')}: {candidate}")
    if urlparse(candidate).path.casefold().endswith(".pdf"):
        return candidate
    request = Request(landing, headers={"User-Agent": "KrugGuideFinder/0.2 (authorized Krug indexer)"})
    with opener(request, timeout=60) as response:
        html = response.read().decode("utf-8", "replace")
    parser = PdfLinks()
    parser.feed(html)
    choices = sorted({urljoin(landing, href) for href in parser.urls if not is_tombstone(urljoin(landing, href))})
    if not choices:
        raise ValueError(f"no PDF link found on {landing}")
    if len(choices) > 1:
        raise ValueError(f"multiple PDF links found on {landing}; add pdf_url explicitly")
    return choices[0]


def download(url, path):
    request = Request(url, headers={"User-Agent": "KrugGuideFinder/0.2 (authorized Krug indexer)"})
    temporary = path.with_suffix(path.suffix + ".download")
    with urlopen(request, timeout=180) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.replace(path)


def validate_manifest(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("guides"), list):
        raise ValueError("manifest must be an object containing a guides array")
    guides, rejected = normalize_guides(payload["guides"], reject_tombstones=False)
    if rejected:
        details = ", ".join(item["url"] for item in rejected)
        raise ValueError(f"manifest contains tombstone entries: {details}")
    if len(guides) != len(payload["guides"]):
        raise ValueError("manifest contains duplicate guide entries")
    return guides


def validate_record(record):
    required = ("model", "guide", "market", "pdf_page", "url")
    missing = [field for field in required if record.get(field) in (None, "")]
    if missing:
        raise ValueError(f"index record missing {', '.join(missing)}: {record!r}")
    canonical_market(record["market"])
    if record.get("guide_page") is not None and not isinstance(record["guide_page"], int):
        raise ValueError("guide_page must be an integer or null")


def deterministic_records(records):
    unique = {}
    for record in records:
        validate_record(record)
        record = dict(record)
        record["market"] = canonical_market(record["market"])
        key = (record["model"], record["guide"], record["market"], record["pdf_page"], record["url"])
        unique[key] = record
    return sorted(unique.values(), key=lambda row: (row["model"], MARKETS.index(row["market"]), row["guide"], row["pdf_page"], row["url"]))


def read_keyword_records(output):
    if not output.exists():
        return []
    payload = json.loads(output.read_text(encoding="utf-8"))
    records = payload.get("keyword_records", [])
    if not isinstance(records, list):
        raise ValueError("existing keyword_records must be an array")
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/search-index.json"))
    parser.add_argument("--cache", type=Path, default=Path(".guide-cache"))
    parser.add_argument("--reuse-cache", action="store_true", help="Reuse cached PDFs for an intentional offline/test run. Normal refreshes re-download every guide.")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    guides = validate_manifest(manifest)
    keyword_records = read_keyword_records(args.output)
    records = []
    from pypdf import PdfReader  # Lazy: validation tests do not need the PDF dependency.

    for guide in guides:
        pdf_url = resolve_pdf_url(guide)
        cache_name = re.sub(r"[^A-Za-z0-9]+", "_", f"{guide['market']}_{guide['guide']}").strip("_") + ".pdf"
        pdf = args.cache / cache_name
        if not args.reuse_cache or not pdf.exists():
            download(pdf_url, pdf)
        reader = PdfReader(str(pdf))
        for number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            for model in model_candidates(text):
                records.append({"model": model, "guide": guide["guide"], "market": guide["market"], "guide_page": printed_page(text), "pdf_page": number, "url": pdf_url})
    result = {"updated": date.today().strftime("%B %d, %Y").replace(" 0", " "), "records": deterministic_records(records), "keyword_records": keyword_records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(result['records'])} model locations and retained {len(keyword_records)} curated keyword locations to {args.output}")


if __name__ == "__main__":
    main()
