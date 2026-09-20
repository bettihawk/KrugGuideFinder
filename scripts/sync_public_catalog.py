#!/usr/bin/env python3
"""Refresh the public price-guide manifest from Krug's Literature page.

The Literature page normally links to a Krug download page rather than directly
to a PDF. ``build_index.py`` understands both forms, so this script preserves
the public landing URL and records a direct ``pdf_url`` only when one is exposed.
"""
import argparse
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

SOURCE = "https://krug.ca/literature/#price-guides"
MARKETS = ("US", "Canada", "GSA", "Vizient")


def canonical_market(value):
    """Return one of the four supported market labels."""
    text = " ".join(str(value or "").split()).casefold()
    if text in {"us", "usa", "united states"}:
        return "US"
    if text in {"canada", "canadian", "cdn", "ca"}:
        return "Canada"
    if text == "gsa":
        return "GSA"
    if text == "vizient":
        return "Vizient"
    raise ValueError(f"unsupported market: {value!r}")


def infer_market(title):
    if re.search(r"\b(?:CDN|CANADIAN)\b", title, re.I):
        return "Canada"
    if re.search(r"\bGSA\b", title, re.I):
        return "GSA"
    if re.search(r"\bVIZIENT\b", title, re.I):
        return "Vizient"
    return "US"


def is_tombstone(url):
    return "/__trashed/" in urlparse(url).path.casefold()


class PriceGuideLinks(HTMLParser):
    """Collect complete anchor text, including text split by nested elements."""

    def __init__(self):
        super().__init__()
        self._href = None
        self._parts = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == "a":
            self._href = dict(attrs).get("href")
            self._parts = []

    def handle_data(self, data):
        if self._href is not None:
            self._parts.append(data)

    def handle_endtag(self, tag):
        if tag.casefold() != "a" or self._href is None:
            return
        title = " ".join("".join(self._parts).split())
        href = self._href
        self._href = None
        self._parts = []
        if "price guide" not in title.casefold() or "/download" not in href:
            return
        url = urljoin(SOURCE, href)
        row = {"guide": title, "market": infer_market(title), "url": url}
        if urlparse(url).path.casefold().endswith(".pdf"):
            row["pdf_url"] = url
        self.links.append(row)


def normalize_guides(rows, *, reject_tombstones=True):
    """Validate, canonicalize and deterministically deduplicate guide rows."""
    normalized = {}
    rejected = []
    for position, raw in enumerate(rows, start=1):
        guide = " ".join(str(raw.get("guide", "")).split())
        url = str(raw.get("url") or raw.get("pdf_url") or "").strip()
        if not guide or not url:
            raise ValueError(f"guide row {position} requires non-empty guide and url")
        if is_tombstone(url):
            rejected.append({"guide": guide, "url": url, "reason": "tombstone"})
            continue
        market = canonical_market(raw.get("market") or infer_market(guide))
        item = {"guide": guide, "market": market, "url": url}
        pdf_url = str(raw.get("pdf_url") or "").strip()
        if pdf_url:
            if is_tombstone(pdf_url):
                rejected.append({"guide": guide, "url": pdf_url, "reason": "tombstone"})
                continue
            item["pdf_url"] = pdf_url
        key = (guide.casefold(), url.casefold())
        normalized.setdefault(key, item)
    guides = sorted(normalized.values(), key=lambda row: (MARKETS.index(row["market"]), row["guide"].casefold(), row["url"]))
    if rejected and reject_tombstones:
        details = ", ".join(item["url"] for item in rejected)
        raise ValueError(f"refusing tombstone guide entries: {details}")
    return guides, rejected


def parse_catalog(html):
    parser = PriceGuideLinks()
    parser.feed(html)
    return normalize_guides(parser.links)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=SOURCE)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "guide-manifest.json")
    args = parser.parse_args()
    request = Request(args.source, headers={"User-Agent": "KrugGuideFinder/0.2 (authorized Krug indexer)"})
    with urlopen(request, timeout=60) as response:
        html = response.read().decode("utf-8", "replace")
    guides, _ = parse_catalog(html)
    payload = {"source_url": args.source, "last_verified": date.today().isoformat(), "guides": guides}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(guides)} validated public guide links to {args.output}")


if __name__ == "__main__":
    main()
