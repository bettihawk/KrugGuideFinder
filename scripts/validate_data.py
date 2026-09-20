#!/usr/bin/env python3
"""Validate checked-in catalog, search, and matching data without network access."""
import json
from pathlib import Path

try:
    from .build_index import validate_manifest
    from .sync_public_catalog import canonical_market, is_tombstone
except ImportError:
    from build_index import validate_manifest
    from sync_public_catalog import canonical_market, is_tombstone

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def validate():
    manifest = load("guide-manifest.json")
    guides = validate_manifest(manifest)
    index = load("search-index.json")
    for section in ("records", "keyword_records"):
        if not isinstance(index.get(section), list):
            raise ValueError(f"search-index {section} must be an array")
        for position, row in enumerate(index[section], start=1):
            for field in ("model", "guide", "market", "url"):
                if not row.get(field):
                    raise ValueError(f"{section} row {position} has no {field}")
            canonical_market(row["market"])
            if is_tombstone(row["url"]):
                raise ValueError(f"{section} row {position} uses a tombstone URL")
            if "guide_page" in row and row["guide_page"] is not None and not isinstance(row["guide_page"], int):
                raise ValueError(f"{section} row {position} guide_page must be integer or null")
    rules = load("matching-rules.json")
    fixtures = load("acceptance-fixtures.json")
    aliases = rules.get("aliases", {})
    for source, forbidden in fixtures.get("must_not_resolve_to", []):
        if forbidden in aliases.get(source, {}).get("targets", []):
            raise ValueError(f"unsafe alias: {source} resolves to {forbidden}")
    return len(guides), len(index["records"]), len(index["keyword_records"])


if __name__ == "__main__":
    counts = validate()
    print(f"Validated {counts[0]} guides, {counts[1]} model locations, and {counts[2]} curated keyword locations.")
