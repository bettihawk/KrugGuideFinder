#!/usr/bin/env python3
"""Refresh the public price-guide catalogue from Krug's Literature page."""
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

SOURCE = "https://krug.ca/literature/#price-guides"

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.href = None; self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a": self.href = dict(attrs).get("href")
    def handle_data(self, data):
        if self.href and "price guide" in data.lower() and "/download/" in self.href:
            self.links.append({"guide": " ".join(data.split()), "url": urljoin(SOURCE, self.href)})
    def handle_endtag(self, tag):
        if tag == "a": self.href = None

def market(title):
    if re.search(r"\bCDN\b", title, re.I): return "Canada"
    if re.search(r"\bGSA\b", title, re.I): return "GSA"
    if re.search(r"Vizient", title, re.I): return "Vizient"
    return "US"

def main():
    request = Request(SOURCE, headers={"User-Agent": "KrugGuideFinder/0.1 (authorized Krug indexer)"})
    with urlopen(request, timeout=60) as response: html = response.read().decode("utf-8", "replace")
    parser = Links(); parser.feed(html)
    seen = set(); guides = []
    for item in parser.links:
        key = (item["guide"], item["url"])
        if key not in seen:
            seen.add(key); guides.append({**item, "market": market(item["guide"])})
    output = Path(__file__).resolve().parents[1] / "data" / "guide-manifest.json"
    output.write_text(json.dumps({"source_url": SOURCE, "last_verified": date.today().isoformat(), "guides": guides}, indent=2) + "\n")
    print(f"Wrote {len(guides)} public guide links to {output}")

if __name__ == "__main__": main()
