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
let records = []; let rules = { aliases: {} };
const status = document.querySelector('#status'); const results = document.querySelector('#results'); const input = document.querySelector('#model');
function card(item, close) {
  const match = close ? `<span class="badge">Similar ${item.score}%</span>` : '';
  return `<article class="card"><div><h3>${item.guide}</h3><p class="model">${item.model}${match}</p><p class="meta">${item.market} · Page ${item.page}</p></div><a href="${item.url}" target="_blank" rel="noopener">Open guide ↗</a></article>`;
}
function planFor(query) {
  const rule = rules.aliases[query];
  const reviewNote = rules.review_only?.[query];
  if (rule) return { rule, candidates: rule.targets.map(normalise) };
  if (reviewNote) return { rule: { label: 'Configuration review required', note: reviewNote }, candidates: [query], reviewOnly: true };
  return { rule: null, candidates: [query] };
}
function search() {
  const query = normalise(input.value);
  if (!query) { results.innerHTML = ''; status.textContent = `Search ${records.length.toLocaleString()} indexed model locations.`; return; }
  const plan = planFor(query);
  const exact = records.filter(r => plan.candidates.includes(normalise(r.model)));
  const similar = exact.length || plan.reviewOnly ? [] : records.map(r => ({...r, score:score(query, r.model)})).filter(r => r.score >= 68).sort((a,b) => b.score-a.score).slice(0,12);
  const heading = plan.rule ? plan.rule.label : 'Exact matches';
  const note = plan.rule ? `<p>${plan.rule.note}</p>` : '';
  status.textContent = exact.length ? `${exact.length} guide location${exact.length === 1 ? '' : 's'} found.` : similar.length ? 'No exact model found. These configurations are the closest matches.' : 'No matching guide locations found.';
  results.innerHTML = exact.length ? `<div class="result-group"><h2>${heading}</h2>${note}${exact.map(r => card(r,!!plan.rule)).join('')}</div>` : similar.length ? `<div class="result-group"><h2>Similar configurations</h2><p>Confirm the product key before quoting or ordering.</p>${similar.map(r => card(r,true)).join('')}</div>` : plan.rule ? `<div class="empty"><strong>${plan.rule.label}.</strong> ${plan.rule.note}</div>` : `<div class="empty">Try entering a product family prefix or check the model number. The public index is refreshed when new guides are published.</div>`;
}
Promise.all([fetch('data/search-index.json').then(r => r.json()), fetch('data/matching-rules.json').then(r => r.json())]).then(([data, loadedRules]) => { records = data.records; rules = loadedRules; status.textContent = `Search ${records.length.toLocaleString()} indexed model locations from ${data.updated}.`; }).catch(() => status.textContent = 'The search index could not be loaded.');
document.querySelector('#search').addEventListener('click', search); input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
