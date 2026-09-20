import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_index
import build_runtime_bundle
import sync_public_catalog


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class CatalogTests(unittest.TestCase):
    def test_nested_anchor_text_and_market_are_captured(self):
        html = '<a href="/download/example/"><span>Example CDN</span> Price Guide 2026</a>'
        guides, rejected = sync_public_catalog.parse_catalog(html)
        self.assertEqual(rejected, [])
        self.assertEqual(guides, [{
            "guide": "Example CDN Price Guide 2026",
            "market": "Canada",
            "url": "https://krug.ca/download/example/",
        }])

    def test_normalization_deduplicates_and_canonicalizes(self):
        rows = [
            {"guide": "Example", "market": "cdn", "url": "https://krug.ca/download/example/"},
            {"guide": "Example", "market": "Canada", "url": "https://krug.ca/download/example/"},
        ]
        guides, rejected = sync_public_catalog.normalize_guides(rows)
        self.assertEqual(len(guides), 1)
        self.assertEqual(guides[0]["market"], "Canada")
        self.assertEqual(rejected, [])

    def test_tombstone_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "tombstone"):
            sync_public_catalog.normalize_guides([{
                "guide": "Broken Vizient Price Guide",
                "market": "Vizient",
                "url": "https://krug.ca/download/__trashed/",
            }])

    def test_manifest_validation_rejects_duplicates(self):
        row = {"guide": "Example", "market": "US", "url": "https://krug.ca/download/example/"}
        with self.assertRaisesRegex(ValueError, "duplicate"):
            build_index.validate_manifest({"guides": [row, dict(row)]})

    def test_checked_in_manifest_has_no_duplicates_or_tombstones(self):
        payload = json.loads((ROOT / "data" / "guide-manifest.json").read_text())
        guides = build_index.validate_manifest(payload)
        self.assertEqual(len(guides), len(payload["guides"]))
        self.assertEqual(len({(x["guide"], x["url"]) for x in guides}), len(guides))


class ExtractionTests(unittest.TestCase):
    def test_printed_page_is_null_when_not_present(self):
        self.assertIsNone(build_index.printed_page("No footer page label here"))
        self.assertEqual(build_index.printed_page("117 | USA | SEATING | 2026"), 117)
        self.assertEqual(build_index.printed_page("GSA | 42"), 42)

    def test_compact_and_separated_models_are_extracted(self):
        text = "KAR218 KAR2-26L_UNAD FAE2G30SNCB V2-G24 A1234 2026 TABLE PAGE117 PRODUCT2"
        self.assertEqual(
            build_index.model_candidates(text),
            ["FAE2G30SNCB", "KAR2-26L_UNAD", "KAR218", "V2-G24"],
        )

    def test_deterministic_records_deduplicate_and_sort(self):
        base = {"guide": "Guide", "market": "USA", "guide_page": None, "pdf_page": 2, "url": "https://example.test/a.pdf"}
        result = build_index.deterministic_records([
            {**base, "model": "ZZZ2"},
            {**base, "model": "AAA2"},
            {**base, "model": "AAA2"},
        ])
        self.assertEqual([x["model"] for x in result], ["AAA2", "ZZZ2"])
        self.assertTrue(all(x["market"] == "US" for x in result))

    def test_landing_page_resolves_one_pdf_without_network(self):
        html = b'<a href="/downloads/priceguides/Test.pdf">Download</a>'

        def opener(_request, timeout):
            self.assertEqual(timeout, 60)
            return FakeResponse(html)

        url = build_index.resolve_pdf_url({
            "guide": "Test",
            "market": "US",
            "url": "https://krug.ca/download/test/",
        }, opener=opener)
        self.assertEqual(url, "https://krug.ca/downloads/priceguides/Test.pdf")

    def test_curated_keyword_records_are_retained(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "index.json"
            expected = [{"model": "Faeron", "keywords": ["faeron"]}]
            output.write_text(json.dumps({"records": [], "keyword_records": expected}))
            self.assertEqual(build_index.read_keyword_records(output), expected)


class MatchingRuleTests(unittest.TestCase):
    def test_karma_black_and_silver_never_resolve_to_chrome(self):
        rules = json.loads((ROOT / "data" / "matching-rules.json").read_text())["aliases"]
        for entered in ("KAR226LBUNAD", "KAR226LSUNAD"):
            self.assertEqual(rules[entered]["targets"], ["KAR2-26L_UNAD"])
            self.assertNotIn("KAR2C-26L_UNAD", rules[entered]["targets"])

    def test_distinct_jordan_codes_remain_review_only(self):
        rules = json.loads((ROOT / "data" / "matching-rules.json").read_text())
        self.assertIn("JD1321N", rules["review_only"])
        self.assertNotIn("JD1321N", rules["aliases"])


class RuntimeBundleTests(unittest.TestCase):
    def test_runtime_bundle_matches_checked_in_json(self):
        expected = build_runtime_bundle.render_bundle(build_runtime_bundle.build_payload())
        self.assertEqual((ROOT / "data" / "runtime-data.js").read_text(encoding="utf-8"), expected)


if __name__ == "__main__":
    unittest.main()
