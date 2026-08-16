const normalise = (value) => value.toUpperCase().replace(/[^A-Z0-9.]/g, "");
const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const saved = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = saved; }
  }
  return row[b.length];
};
const score = (query, model) => Math.round(100 * (1 - distance(query, normalise(model)) / Math.max(query.length, normalise(model).length)));
let records = []; let keywordRecords = []; let rules = { aliases: {} };
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
const status = document.querySelector('#status'); const results = document.querySelector('#results'); const input = document.querySelector('#model'); const marketSelect = document.querySelector('#market'); const searchButton = document.querySelector('#search'); let indexReady = false;
function card(item, close) {
  const match = close ? `<span class="badge">Similar ${item.score}%</span>` : '';
  const guidePage = item.guide_page ?? item.page;
  const pdfPage = item.pdf_page ?? item.page;
  const hasPage = Number.isFinite(Number(pdfPage));
  const pageUrl = `${item.url}${item.url.includes('#') ? '&' : '#'}page=${pdfPage}`;
  const viewerUrl = `viewer.html?file=${encodeURIComponent(item.url)}&page=${pdfPage}&guidePage=${encodeURIComponent(guidePage)}&title=${encodeURIComponent(item.guide)}`;
  const description = item.description ? `<p class="description">${item.description}</p>` : '';
  const meta = hasPage ? `${item.market} · Guide page ${guidePage}` : `${item.market} · Product category`;
  const actions = hasPage ? `<a href="${viewerUrl}" target="_blank" rel="noopener">View guide page ${guidePage} ↗</a><a class="source-link" href="${pageUrl}" target="_blank" rel="noopener">Original PDF</a>` : `<a href="${item.url}" target="_blank" rel="noopener">Open guide ↗</a>`;
  return `<article class="card"><div><h3>${item.guide}</h3><p class="model">${item.model}${match}</p>${description}<p class="meta">${meta}</p></div><div class="actions">${actions}</div></article>`;
}
function keywordTokens(value) {
  const singular = { chairs: 'chair', tables: 'table', lounges: 'lounge', models: 'model' };
  const ignored = new Set(['a', 'an', 'and', 'for', 'of', 'the', 'with']);
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(token => token && !ignored.has(token)).map(token => singular[token] || token);
}
function catalogueRecord(guide) {
  const ignored = new Set(['price', 'guide', '2026', 'us', 'cdn', 'gsa', 'vizient', 'healthcare', 'commercial', 'behavioral', 'behavioural']);
  const keywords = keywordTokens(guide.guide).filter(token => !ignored.has(token));
  if (/\bBH\b/i.test(guide.guide)) keywords.push('behavioral', 'behavioural', 'health');
  return { ...guide, model: guide.guide, description: 'Current public Krug price guide', keywords };
}
function planFor(query) {
  const rule = rules.aliases[query];
  const reviewNote = rules.review_only?.[query];
  if (rule) return { rule, candidates: rule.targets.map(normalise) };
  if (reviewNote) return { rule: { label: 'Configuration review required', note: reviewNote }, candidates: [query], reviewOnly: true };
  return { rule: null, candidates: [query] };
}
function search() {
  if (!indexReady) { status.textContent = 'Loading the current public guide index…'; return; }
  const query = normalise(input.value);
  const selectedMarket = marketSelect.value;
  const inMarket = item => selectedMarket === 'all' || item.market === selectedMarket || (selectedMarket === 'Canada' && ['Canadian', 'CA'].includes(item.market));
  const marketLabel = selectedMarket === 'Canada' ? 'Canadian' : selectedMarket;
  if (!query) { results.innerHTML = ''; status.textContent = `Search ${records.length.toLocaleString()} indexed model locations.`; return; }
  const plan = planFor(query);
  const exact = records.filter(r => inMarket(r) && plan.candidates.includes(normalise(r.model)));
  const keywords = keywordTokens(input.value);
  const keywordMatches = exact.length || !keywords.length ? [] : keywordRecords.filter(record => inMarket(record) && keywords.every(token => record.keywords.includes(token)));
  const similar = exact.length || keywordMatches.length || plan.reviewOnly ? [] : records.filter(inMarket).map(r => ({...r, score:score(query, r.model)})).filter(r => r.score >= 68).sort((a,b) => b.score-a.score).slice(0,12);
  const heading = plan.rule ? plan.rule.label : 'Exact matches';
  const note = plan.rule ? `<p>${plan.rule.note}</p>` : '';
  status.textContent = exact.length ? `${exact.length} guide location${exact.length === 1 ? '' : 's'} found.` : keywordMatches.length ? `${keywordMatches.length} product-category match${keywordMatches.length === 1 ? '' : 'es'} found.` : similar.length ? 'No exact model found. These configurations are the closest matches.' : selectedMarket === 'all' ? 'No matching guide locations found.' : `No ${marketLabel} guide locations found.`;
  results.innerHTML = exact.length ? `<div class="result-group"><h2>${heading}</h2>${note}${exact.map(r => card(r,!!plan.rule)).join('')}</div>` : keywordMatches.length ? `<div class="result-group"><h2>Product-category matches</h2><p>Matched on the product terms you entered. Select a guide page to see the listed model configurations.</p>${keywordMatches.map(r => card(r,false)).join('')}</div>` : similar.length ? `<div class="result-group"><h2>Similar configurations</h2><p>Confirm the product key before quoting or ordering.</p>${similar.map(r => card(r,true)).join('')}</div>` : plan.rule ? `<div class="empty"><strong>${plan.rule.label}.</strong> ${plan.rule.note}</div>` : selectedMarket === 'all' ? `<div class="empty">Try entering a product family prefix, a product description, or check the model number. The public index is refreshed when new guides are published.</div>` : `<div class="empty">There are no indexed ${marketLabel} guide matches for this search yet. Select “Search all guides” to see matches in every market.</div>`;
}
searchButton.disabled = true;
Promise.all([fetch('data/search-index.json?v=search-ready-20260816', { cache: 'no-store' }).then(r => r.json()), fetch('data/matching-rules.json?v=search-ready-20260816', { cache: 'no-store' }).then(r => r.json()), fetch('data/guide-manifest.json?v=search-ready-20260816', { cache: 'no-store' }).then(r => r.json())]).then(([data, loadedRules, catalogue]) => { records = data.records; keywordRecords = [...new Map([...builtInKeywordRecords, ...(data.keyword_records || []), ...(catalogue.guides || []).map(catalogueRecord)].map(item => [`${item.model}|${item.guide}`, item])).values()]; rules = loadedRules; indexReady = true; searchButton.disabled = false; status.textContent = `Search ${records.length.toLocaleString()} indexed model locations and ${(catalogue.guides || []).length.toLocaleString()} current public guides from ${data.updated}.`; if (input.value.trim()) search(); }).catch(() => { keywordRecords = builtInKeywordRecords; indexReady = true; searchButton.disabled = false; status.textContent = 'Product-category search is available. The full model index could not be loaded.'; if (input.value.trim()) search(); });
document.querySelector('#search').addEventListener('click', search); input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
