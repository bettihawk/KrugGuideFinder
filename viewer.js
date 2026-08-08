import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
const params = new URLSearchParams(location.search);
const file = params.get('file');
const requestedPage = Number(params.get('page')) || 1;
const title = params.get('title') || 'Price guide';
const error = document.querySelector('#error');
document.querySelector('#guide-title').textContent = title;
const original = document.querySelector('#original-pdf');
original.href = file ? `${file}#page=${requestedPage}` : 'index.html';

async function render() {
  if (!file || !/^https:\/\//.test(file)) throw new Error('This page link is incomplete. Return to Guide Finder and try again.');
  const pdf = await pdfjsLib.getDocument(file).promise;
  if (requestedPage > pdf.numPages) throw new Error(`This guide has ${pdf.numPages} pages; page ${requestedPage} is unavailable.`);
  const page = await pdf.getPage(requestedPage);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.max(1, (window.innerWidth - 32) / base.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.querySelector('#page-canvas'); const context = canvas.getContext('2d');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  document.querySelector('#page-label').textContent = `Page ${requestedPage} of ${pdf.numPages}`;
}
render().catch(err => { error.hidden = false; error.textContent = `Unable to display this page. ${err.message}`; document.querySelector('#page-label').textContent = `Page ${requestedPage}`; });
