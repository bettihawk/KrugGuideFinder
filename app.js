// Model punctuation is ignored except for decimal points: 18.5 and 185 are
// different sizes. This is deliberately separate from keyword tokenisation.
const normalise = (value = '') => String(value).toUpperCase().replace(/[^A-Z0-9.]/g, "");
const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const saved = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = saved; }
  }
  return row[b.length];
};
const keywordDistance = (a, b) => {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
};
const score = (query, model) => {
  const candidate = normalise(model);
  const length = Math.max(query.length, candidate.length);
  return length ? Math.round(100 * (1 - distance(query, candidate) / length)) : 100;
};
const MARKET_ALIASES = Object.freeze({
  all: 'all', us: 'US', usa: 'US', unitedstates: 'US',
  canada: 'Canada', canadian: 'Canada', ca: 'Canada', cdn: 'Canada',
  gsa: 'GSA', vizient: 'Vizient'
});
const canonicalMarket = (market = '') => MARKET_ALIASES[String(market).toLowerCase().replace(/[^a-z]/g, '')] || String(market);
const isInMarket = (item, selectedMarket = 'all') => {
  const selected = canonicalMarket(selectedMarket);
  return selected === 'all' || canonicalMarket(item.market) === selected;
};
const safeKrugUrl = (value) => {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'https:' && (parsed.hostname === 'krug.ca' || parsed.hostname.endsWith('.krug.ca')) ? parsed.href : null;
  } catch { return null; }
};
const pageLinkData = (item) => {
  const guidePage = item.guide_page ?? item.page ?? null;
  const pdfPage = item.pdf_page ?? item.page ?? item.guide_page;
  const sourceUrl = safeKrugUrl(item.url);
  const hasPage = Number.isFinite(Number(pdfPage)) && Number(pdfPage) > 0;
  if (!sourceUrl) return { sourceUrl: null, hasPage, guidePage, pdfPage };
  const source = new URL(sourceUrl);
  if (hasPage) source.hash = `page=${pdfPage}`;
  const viewerParams = hasPage ? new URLSearchParams({ file: sourceUrl, page: String(pdfPage), title: item.guide || '' }) : null;
  if (viewerParams && guidePage != null) viewerParams.set('guidePage', String(guidePage));
  return { sourceUrl: source.href, hasPage, guidePage, pdfPage, viewerUrl: viewerParams ? `viewer.html?${viewerParams}` : null };
};
let records = []; let keywordRecords = []; let rules = { aliases: {}, review_only: {} };
// Essential category matches live here too, so a stale JSON cache cannot disable search.
const builtInKeywordRecords = [
  ['Nuvo Tables with power','Nuvo US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Nuvo_US_PriceGuide_2026.pdf'],
  ['V2 Tables with power','V2 US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_V2_US_PriceGuide_2026.pdf'],
  ['Ando Tables with power','Ando US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Ando_US_PriceGuide_2026.pdf'],
  ['Revo Tables with power','Revo US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Revo_US_PriceGuide_2026.pdf'],
  ['Gira Tables with power','Gira US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Gira_US_PriceGuide_2026.pdf'],
  ['Millennium Conference Tables with power','Millennium Conference US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Millennium_Conference_US_PriceGuide_2026.pdf'],
  ['Stratford Conference Tables with power','Stratford Conference US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Stratford_Conference_US_PriceGuide_2026.pdf'],
  ['Virtu Conference Tables with power','Virtu Conference US Price Guide 2026','https://krug.ca/downloads/priceguides/Krug_Virtu_Conference_US_PriceGuide_2026.pdf']
  ,['Ando Tables with power','Ando Canadian Price Guide 2026','https://krug.ca/download/ando-cdn-price-guide-2024/','Canada']
  ,['Nuvo Tables with power','Nuvo Canadian Price Guide 2026','https://krug.ca/download/nuvo-cdn-price-guide-2024/','Canada']
  ,['V2 Tables with power','V2 Canadian Price Guide 2026','https://krug.ca/download/v2-cdn-price-guide-2024/','Canada']
  ,['Revo Tables with power','Revo Canadian Price Guide 2026','https://krug.ca/download/revo-cdn-price-guide-2024/','Canada']
  ,['Gira Tables with power','Gira Canadian Price Guide 2026','https://krug.ca/download/gira-cdn-price-guide-2026/','Canada']
  ,['Millennium Conference Tables with power','Millennium Conference Canadian Price Guide 2026','https://krug.ca/download/millennium-conference-cdn-price-guide-2024/','Canada']
  ,['Stratford Conference Tables with power','Stratford Conference Canadian Price Guide 2026','https://krug.ca/download/stratford-conference-cdn-price-guide-2024/','Canada']
  ,['Virtu Conference Tables with power','Virtu Conference Canadian Price Guide 2026','https://krug.ca/download/virtu-conference-cdn-price-guide/','Canada']
  ,['Ando Tables with power','Ando GSA Price Guide 2026','https://krug.ca/download/ando-gsa-price-guide/','GSA']
  ,['Nuvo Tables with power','Nuvo GSA Price Guide 2026','https://krug.ca/download/nuvo-gsa-price-guide/','GSA']
  ,['V2 Tables with power','V2 GSA Price Guide 2026','https://krug.ca/download/v2-gsa-price-guide/','GSA']
  ,['Revo Tables with power','Revo GSA Price Guide 2026','https://krug.ca/download/revo-gsa-price-guide/','GSA']
  ,['Gira Tables with power','Gira GSA Price Guide 2026','https://krug.ca/download/gira-gsa-price-guide-2026/','GSA']
  ,['Millennium Conference Tables with power','Millennium Conference GSA Price Guide 2026','https://krug.ca/download/millennium-conference-gsa-price-guide/','GSA']
  ,['Stratford Conference Tables with power','Stratford Conference GSA Price Guide 2026','https://krug.ca/download/stratford-conference-gsa-price-guide/','GSA']
  ,['Virtu Conference Tables with power','Virtu Conference GSA Price Guide 2026','https://krug.ca/download/virtu-conference-gsa-price-guide/','GSA']
  ,['Ando Tables with power','Ando Vizient Price Guide 2026','https://krug.ca/download/ando-vizient/','Vizient']
  ,['Nuvo Tables with power','Nuvo Vizient Price Guide 2026','https://krug.ca/download/nuvo-price-guide-vizient/','Vizient']
  ,['V2 Tables with power','V2 Vizient Price Guide 2026','https://krug.ca/download/v2-price-guide-vizient/','Vizient']
  ,['Revo Tables with power','Revo Vizient Price Guide 2026','https://krug.ca/download/revo-price-guide-vizient/','Vizient']
  ,['Millennium Conference Tables with power','Millennium Conference Vizient Price Guide 2026','https://krug.ca/download/millennium-conference-priceguide-vizient/','Vizient']
  ,['Stratford Conference Tables with power','Stratford Conference Vizient Price Guide 2026','https://krug.ca/download/stratford-conference-price-guide-vizient/','Vizient']
  ,['Virtu Conference Tables with power','Virtu Vizient Price Guide 2026','https://krug.ca/download/virtu-price-guide-vizient/','Vizient']
].map(([model, guide, url, market = 'US']) => ({ model, guide, url, market, keywords: ['table', 'power'] }));
function keywordTokens(value) {
  const singular = { chairs: 'chair', tables: 'table', lounges: 'lounge', models: 'model' };
  const spelling = { behavioural: 'behavioral', grey: 'gray', milenium: 'millennium', millenium: 'millennium' };
  const ignored = new Set(['a', 'an', 'and', 'for', 'of', 'the', 'with']);
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(token => token && !ignored.has(token)).map(token => spelling[singular[token] || token] || singular[token] || token);
}
function catalogueRecord(guide) {
  const ignored = new Set(['price', 'guide', '2026', 'us', 'cdn', 'gsa', 'vizient', 'healthcare', 'commercial', 'behavioral', 'behavioural']);
  const keywords = keywordTokens(guide.guide).filter(token => !ignored.has(token));
  if (/\bBH\b/i.test(guide.guide)) keywords.push('behavioral', 'health');
  return { ...guide, model: guide.guide, description: 'Current public Krug price guide', keywords };
}
function correctKeywordTypos(tokens, sourceRecords = keywordRecords) {
  const vocabulary = [...new Set(sourceRecords.flatMap(record => (record.keywords || []).flatMap(keywordTokens)).filter(word => word.length >= 5))].sort();
  return tokens.map(token => {
    if (token.length < 5 || /\d/.test(token) || vocabulary.includes(token)) return token;
    const matches = vocabulary.map(word => ({ word, distance: keywordDistance(token, word) }))
      .filter(match => match.word[0] === token[0] && match.distance <= 1)
      .sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word));
    return matches.length && (matches.length === 1 || matches[0].distance < matches[1].distance) ? matches[0].word : token;
  });
}
function dedupeKeywordMatches(matches) {
  const unique = new Map();
  matches.forEach((item) => {
    const hasPage = Number.isFinite(Number(item.pdf_page ?? item.page));
    const key = hasPage
      ? `${item.model}|${item.guide}|${canonicalMarket(item.market)}|${item.pdf_page ?? item.page}`
      : `${item.guide}|${canonicalMarket(item.market)}|${safeKrugUrl(item.url) || item.url}`;
    const current = unique.get(key);
    const detail = (item.keywords || []).length + (item.description ? 1 : 0);
    const currentDetail = current ? (current.keywords || []).length + (current.description ? 1 : 0) : -1;
    if (!current || detail > currentDetail) unique.set(key, item);
  });
  return [...unique.values()];
}
function planFor(query, matchingRules = rules) {
  const rule = matchingRules.aliases?.[query];
  const reviewNote = matchingRules.review_only?.[query];
  if (rule) return { rule, candidates: rule.targets.map(normalise) };
  if (reviewNote) return { rule: { label: 'Configuration review required', note: reviewNote }, candidates: [query], reviewOnly: true };
  return { rule: null, candidates: [query] };
}

function findMatches({ input = '', market = 'all', records: modelRecords = [], keywordRecords: products = [], rules: matchingRules = { aliases: {}, review_only: {} } }) {
  const query = normalise(input);
  if (!query) return { kind: 'empty', query, matches: [], plan: planFor(query, matchingRules), keywords: [] };
  const plan = planFor(query, matchingRules);
  const availableModels = modelRecords.filter(item => isInMarket(item, market));
  const exact = availableModels.filter(item => plan.candidates.includes(normalise(item.model)));
  if (exact.length) return { kind: plan.rule ? 'alias' : 'exact', query, matches: exact, plan, keywords: [] };

  // First try the entire entered prefix. A narrowly bounded legacy family
  // fallback is handled separately below.
  const looksLikeModel = /[A-Z]/.test(query) && /\d/.test(query);
  const partial = !plan.reviewOnly && looksLikeModel && query.length >= 3
    ? availableModels.filter(item => normalise(item.model).startsWith(query)) : [];
  if (partial.length) return { kind: 'partial', query, matches: partial, plan, keywords: [] };

  // Preserve the established compact-family lookup for a single extra
  // character (for example KAR22 -> KAR2 family) without allowing a long,
  // mistyped code such as KAR2999 to fan out across the whole family.
  const familyPrefix = query.match(/^([A-Z]{2,7}\d)/)?.[1];
  const familyMatches = !plan.reviewOnly && familyPrefix && query.length === familyPrefix.length + 1
    ? availableModels.filter(item => normalise(item.model).startsWith(familyPrefix)) : [];
  if (familyMatches.length) return { kind: 'family', query, matches: familyMatches, plan, keywords: [] };

  const keywords = correctKeywordTypos(keywordTokens(input), products);
  const keywordMatches = !plan.reviewOnly && keywords.length
    ? dedupeKeywordMatches(products.filter(item => {
      const itemKeywords = new Set((item.keywords || []).flatMap(keywordTokens));
      return isInMarket(item, market) && keywords.every(token => itemKeywords.has(token));
    })) : [];
  if (keywordMatches.length) return { kind: 'keyword', query, matches: keywordMatches, plan, keywords };

  // A curated rule is authoritative. If its target is not in the current
  // index, show the rule's review message instead of substituting a fuzzy hit.
  const similar = plan.rule ? [] : availableModels.map(item => ({ ...item, score: score(query, item.model) }))
    .filter(item => item.score >= 68)
    .sort((a, b) => b.score - a.score || String(a.model).localeCompare(String(b.model)) || String(a.guide).localeCompare(String(b.guide)))
    .slice(0, 12);
  return { kind: similar.length ? 'similar' : plan.rule ? 'review' : 'none', query, matches: similar, plan, keywords };
}

function appendTextElement(parent, tag, text, className) {
  const element = document.createElement(tag); element.textContent = text;
  if (className) element.className = className;
  parent.append(element); return element;
}
function createCard(item, kind) {
  const article = document.createElement('article'); article.className = 'card';
  const content = document.createElement('div');
  appendTextElement(content, 'h3', item.guide || 'Krug price guide');
  const model = appendTextElement(content, 'p', item.model || '', 'model');
  if (kind === 'similar' && Number.isFinite(item.score)) appendTextElement(model, 'span', `Similar ${item.score}%`, 'badge');
  if (item.description) appendTextElement(content, 'p', item.description, 'description');
  const { guidePage, pdfPage, hasPage, sourceUrl, viewerUrl } = pageLinkData(item);
  const pageLabel = guidePage == null ? `PDF page ${pdfPage}` : `Guide page ${guidePage}`;
  appendTextElement(content, 'p', hasPage ? `${canonicalMarket(item.market)} · ${pageLabel}` : `${canonicalMarket(item.market)} · Product category`, 'meta');
  article.append(content);
  const actions = document.createElement('div'); actions.className = 'actions';
  if (sourceUrl) {
    if (hasPage) {
      const visiblePage = guidePage == null ? `PDF page ${pdfPage}` : `guide page ${guidePage}`;
      const viewer = appendTextElement(actions, 'a', `View ${visiblePage} ↗`); viewer.href = viewerUrl; viewer.target = '_blank'; viewer.rel = 'noopener'; viewer.setAttribute('aria-label', `View ${visiblePage} in ${item.guide || 'Krug price guide'}`);
      const pdf = appendTextElement(actions, 'a', `Original PDF · PDF page ${pdfPage}`, 'source-link'); pdf.href = sourceUrl; pdf.target = '_blank'; pdf.rel = 'noopener'; pdf.setAttribute('aria-label', `Open ${item.guide || 'Krug price guide'} at PDF page ${pdfPage}`);
    } else {
      const link = appendTextElement(actions, 'a', 'Open guide ↗'); link.href = sourceUrl; link.target = '_blank'; link.rel = 'noopener'; link.setAttribute('aria-label', `Open ${item.guide || 'Krug price guide'}`);
    }
  }
  article.append(actions); return article;
}
function renderSearch(outcome, selectedMarket, status, results) {
  results.replaceChildren();
  const market = canonicalMarket(selectedMarket); const marketLabel = market === 'Canada' ? 'Canadian' : market;
  const count = outcome.matches.length;
  const messages = {
    exact: `${count} guide location${count === 1 ? '' : 's'} found.`, alias: `${count} guide location${count === 1 ? '' : 's'} found.`,
    partial: `${count} partial model match${count === 1 ? '' : 'es'} found.`, family: `${count} possible model-family match${count === 1 ? '' : 'es'} found.`, keyword: `${count} product-category match${count === 1 ? '' : 'es'} found.`,
    similar: 'No exact model found. These configurations are the closest matches.', review: 'Configuration review required.',
    none: market === 'all' ? 'No matching guide locations found.' : `No ${marketLabel} guide locations found.`
  };
  status.textContent = messages[outcome.kind] || '';
  if (outcome.kind === 'empty') return;
  if (!count) {
    const empty = document.createElement('div'); empty.className = 'empty';
    if (outcome.plan.rule) { appendTextElement(empty, 'strong', `${outcome.plan.rule.label}. `); empty.append(document.createTextNode(outcome.plan.rule.note || '')); }
    else empty.textContent = market === 'all' ? 'Try entering a product family prefix, a product description, or check the model number. The public index is refreshed when new guides are published.' : `There are no indexed ${marketLabel} guide matches for this search yet. Select “Search all guides” to see matches in every market.`;
    results.append(empty); return;
  }
  const group = document.createElement('div'); group.className = 'result-group';
  const headings = { exact: 'Exact matches', alias: outcome.plan.rule?.label || 'Matched configuration', partial: 'Partial model matches', family: 'Possible model-family matches', keyword: 'Product-category matches', similar: 'Similar configurations' };
  appendTextElement(group, 'h2', headings[outcome.kind]);
  if (outcome.kind === 'alias' && outcome.plan.rule.note) appendTextElement(group, 'p', outcome.plan.rule.note);
  if (outcome.kind === 'partial') appendTextElement(group, 'p', 'These configurations share the full model prefix you entered. Confirm the full product key before quoting or ordering.');
  if (outcome.kind === 'family') appendTextElement(group, 'p', 'No full-prefix match was found, so these results use the shorter product-family key. Confirm the complete model number before quoting or ordering.');
  if (outcome.kind === 'keyword') appendTextElement(group, 'p', 'Matched on the product terms you entered. Page-specific matches open at the listed page; broader category matches open the guide.');
  if (outcome.kind === 'similar') appendTextElement(group, 'p', 'Confirm the product key before quoting or ordering.');
  outcome.matches.forEach(item => group.append(createCard(item, outcome.kind)));
  results.append(group);
}

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}
async function initialise() {
  const status = document.querySelector('#status'); const results = document.querySelector('#results');
  const input = document.querySelector('#model'); const marketSelect = document.querySelector('#market'); const searchButton = document.querySelector('#search');
  if (!status || !results || !input || !marketSelect || !searchButton) return;
  searchButton.disabled = true;
  const loaded = await Promise.allSettled([
    loadJson('data/search-index.json?v=search-core-20260920'),
    loadJson('data/matching-rules.json?v=search-core-20260920'),
    loadJson('data/guide-manifest.json?v=search-core-20260920')
  ]);
  const data = loaded[0].status === 'fulfilled' ? loaded[0].value : {};
  const loadedRules = loaded[1].status === 'fulfilled' ? loaded[1].value : null;
  const catalogue = loaded[2].status === 'fulfilled' ? loaded[2].value : {};
  records = Array.isArray(data.records) ? data.records : [];
  rules = loadedRules || { aliases: {}, review_only: {} };
  keywordRecords = [...new Map([...builtInKeywordRecords, ...(data.keyword_records || []), ...(catalogue.guides || []).map(catalogueRecord)].map(item => [`${item.model}|${item.guide}|${canonicalMarket(item.market)}`, item])).values()];
  const run = () => {
    if (!input.value.trim()) { results.replaceChildren(); status.textContent = `Search ${records.length.toLocaleString()} indexed model locations.`; return; }
    renderSearch(findMatches({ input: input.value, market: marketSelect.value, records, keywordRecords, rules }), marketSelect.value, status, results);
  };
  searchButton.disabled = false;
  const failures = loaded.filter(item => item.status === 'rejected').length;
  status.textContent = failures ? `Search is available. ${failures} index source${failures === 1 ? '' : 's'} could not be loaded.` : `Search ${records.length.toLocaleString()} indexed model locations and ${(catalogue.guides || []).length.toLocaleString()} current public guides from ${data.updated || 'the latest index'}.`;
  searchButton.addEventListener('click', run); input.addEventListener('keydown', event => { if (event.key === 'Enter') run(); }); marketSelect.addEventListener('change', () => { if (input.value.trim()) run(); });
  if (input.value.trim()) run();
}

const SearchCore = { normalise, distance, keywordDistance, score, canonicalMarket, isInMarket, safeKrugUrl, pageLinkData, keywordTokens, catalogueRecord, correctKeywordTypos, dedupeKeywordMatches, planFor, findMatches };
if (typeof module !== 'undefined' && module.exports) module.exports = SearchCore;
if (typeof window !== 'undefined') { window.KrugSearchCore = SearchCore; initialise(); }
