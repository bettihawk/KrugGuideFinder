const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalise, canonicalMarket, safeKrugUrl, pageLinkData, keywordTokens,
  correctKeywordTypos, findMatches
} = require('../app.js');

const karmaGuest = {
  model: 'KAR2-18.5', guide: 'Karma US', market: 'US', guide_page: 138,
  pdf_page: 139, url: 'https://krug.ca/downloads/karma.pdf'
};
const karma26 = { model: 'KAR2C-26L_U_D', guide: 'Karma US', market: 'US', page: 8, url: 'https://krug.ca/downloads/karma.pdf' };
const records = [
  karmaGuest, karma26,
  { ...karma26, guide: 'Karma Canadian', market: 'Canadian', url: 'https://krug.ca/download/karma-canadian/' },
  { model: 'JD1321N', guide: 'Jordan', market: 'US', page: 1, url: 'https://krug.ca/downloads/jordan.pdf' },
  { model: 'JD1SS1321N', guide: 'Jordan', market: 'US', page: 2, url: 'https://krug.ca/downloads/jordan.pdf' }
];
const keywordRecords = [
  { model: 'Faeron Lounge', guide: 'Faeron US', market: 'US', keywords: ['faeron', 'lounge', 'chair'], url: 'https://krug.ca/downloads/faeron.pdf' },
  { model: 'Faeron Lounge', guide: 'Faeron CDN', market: 'CDN', keywords: ['faeron', 'lounge', 'chair'], url: 'https://krug.ca/download/faeron/' },
  { model: 'Table with power', guide: 'Ando GSA', market: 'GSA', keywords: ['table', 'power'], url: 'https://krug.ca/download/ando/' },
  { model: 'Ando rectangular table with power', guide: 'Ando GSA', market: 'GSA', keywords: ['ando', 'rectangular', 'table', 'power'], url: 'https://krug.ca/download/ando/' }
];
const rules = {
  aliases: {
    KAR218: { targets: ['KAR2-18.5'], label: 'Karma Guest Seating', note: '18.5-inch family' }
  },
  review_only: {
    JD1321N: 'Distinct from JD1SS1321N.',
    FAE4441622: 'Possible transposition; do not auto-correct.'
  }
};
const search = (input, market = 'all') => findMatches({ input, market, records, keywordRecords, rules });

test('model normalisation ignores case and separators but preserves decimal sizes', () => {
  assert.equal(normalise('kar2-18.5'), 'KAR218.5');
  assert.equal(normalise('KAR2_18.5'), 'KAR218.5');
  assert.notEqual(normalise('KAR2-18.5'), normalise('KAR2-185'));
});

test('KAR218 resolves through its narrow alias to 18.5-inch Karma Guest seating', () => {
  const result = search('kar218');
  assert.equal(result.kind, 'alias');
  assert.deepEqual(result.matches.map(item => item.model), ['KAR2-18.5']);
  assert.ok(result.matches.every(item => item.score === undefined));
});

test('partial model matching respects the whole entered prefix', () => {
  assert.equal(search('KAR2C26').kind, 'partial');
  assert.deepEqual(search('KAR2C26').matches.map(item => item.model), ['KAR2C-26L_U_D', 'KAR2C-26L_U_D']);
  assert.equal(search('KAR22').kind, 'family');
  assert.ok(search('KAR22').matches.every(item => normalise(item.model).startsWith('KAR2')));
  assert.equal(search('KAR2999').kind, 'none');
});

test('exact model precedence prevents broader partial and fuzzy output', () => {
  const result = search('KAR2C-26L_U_D');
  assert.equal(result.kind, 'exact');
  assert.equal(result.matches.length, 2);
});

test('fuzzy model fallback is scored only after exact, partial, and keyword searches fail', () => {
  const result = search('JD1321M');
  assert.equal(result.kind, 'similar');
  assert.equal(result.matches[0].model, 'JD1321N');
  assert.ok(Number.isFinite(result.matches[0].score));
});

test('review-only models remain distinct and suppress fuzzy fallback', () => {
  const exact = search('JD1321N');
  assert.equal(exact.kind, 'alias');
  assert.deepEqual(exact.matches.map(item => item.model), ['JD1321N']);
  assert.ok(!exact.matches.some(item => item.model === 'JD1SS1321N'));
  const caution = search('FAE4-44-16-22');
  assert.equal(caution.kind, 'review');
  assert.equal(caution.matches.length, 0);
});

test('a curated alias with a missing indexed target does not fall through to fuzzy data', () => {
  const aliasRules = { aliases: { JD1321M: { targets: ['NOT-IN-INDEX'], label: 'Curated correction', note: 'Verify this model.' } }, review_only: {} };
  const result = findMatches({ input: 'JD1321M', records, keywordRecords, rules: aliasRules });
  assert.equal(result.kind, 'review');
  assert.equal(result.matches.length, 0);
});

test('market aliases are canonical and market filtering is exact', () => {
  assert.equal(canonicalMarket('Canadian'), 'Canada');
  assert.equal(canonicalMarket('CDN'), 'Canada');
  assert.equal(search('KAR2C26', 'Canada').matches.length, 1);
  assert.equal(search('KAR2C26', 'GSA').kind, 'none');
  const power = search('table with power', 'GSA');
  assert.equal(power.kind, 'keyword');
  assert.equal(power.matches.length, 1);
  assert.equal(power.matches[0].model, 'Ando rectangular table with power');
});

test('keyword spelling, stop words, and a unique transposition typo behave deterministically', () => {
  assert.deepEqual(keywordTokens('A chair WITH grey arms'), ['chair', 'gray', 'arms']);
  assert.deepEqual(correctKeywordTypos(['fearon', 'lounge'], keywordRecords), ['faeron', 'lounge']);
  const result = search('Fearon lounge chair', 'US');
  assert.equal(result.kind, 'keyword');
  assert.equal(result.matches[0].model, 'Faeron Lounge');
});

test('short product-family prefixes return possible related guides', () => {
  assert.equal(search('fa', 'US').kind, 'keyword');
  assert.equal(search('fa', 'US').matches[0].model, 'Faeron Lounge');
  assert.equal(search('kar', 'US').kind, 'none');
  const catalogueProducts = [
    ...keywordRecords,
    { model: 'Karma US Price Guide', guide: 'Karma US Price Guide', market: 'US', keywords: ['karma'], url: 'https://krug.ca/download/karma/' },
    { model: 'Jordan US Price Guide', guide: 'Jordan US Price Guide', market: 'US', keywords: ['jordan'], url: 'https://krug.ca/download/jordan/' }
  ];
  assert.equal(findMatches({ input: 'kar', market: 'US', records, keywordRecords: catalogueProducts, rules }).kind, 'keyword');
  assert.equal(findMatches({ input: 'jo', market: 'US', records, keywordRecords: catalogueProducts, rules }).matches[0].model, 'Jordan US Price Guide');
});

test('ambiguous one-edit keyword candidates are not guessed', () => {
  const candidates = [
    { keywords: ['chair'] },
    { keywords: ['chain'] }
  ];
  assert.deepEqual(correctKeywordTypos(['chait'], candidates), ['chait']);
});

test('printed guide page and physical PDF page remain separate in links', () => {
  const links = pageLinkData(karmaGuest);
  assert.equal(links.guidePage, 138);
  assert.equal(links.pdfPage, 139);
  assert.match(links.sourceUrl, /#page=139$/);
  assert.match(links.viewerUrl, /page=139/);
  assert.match(links.viewerUrl, /guidePage=138/);
});

test('an unknown printed page stays unknown instead of copying the PDF page', () => {
  const links = pageLinkData({ ...karmaGuest, guide_page: null });
  assert.equal(links.guidePage, null);
  assert.equal(links.pdfPage, 139);
  assert.doesNotMatch(links.viewerUrl, /guidePage=/);
});

test('only HTTPS krug.ca links are allowed', () => {
  assert.equal(safeKrugUrl('javascript:alert(1)'), null);
  assert.equal(safeKrugUrl('http://krug.ca/file.pdf'), null);
  assert.equal(safeKrugUrl('https://krug.ca.evil.example/file.pdf'), null);
  assert.equal(safeKrugUrl('https://downloads.krug.ca/file.pdf'), 'https://downloads.krug.ca/file.pdf');
});
