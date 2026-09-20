const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const params = new URLSearchParams(location.search);
const file = params.get('file');
const requestedPageValue = Number(params.get('page')) || 1;
const requestedPage = Number.isInteger(requestedPageValue) && requestedPageValue > 0 ? requestedPageValue : 1;
const guidePageValue = Number(params.get('guidePage'));
const guidePage = Number.isInteger(guidePageValue) && guidePageValue > 0 ? guidePageValue : null;
const title = params.get('title') || 'Price guide';

function safeKrugUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'https:' && (parsed.hostname === 'krug.ca' || parsed.hostname.endsWith('.krug.ca')) ? parsed.href : null;
  } catch {
    return null;
  }
}

const safeFile = safeKrugUrl(file);

const error = document.querySelector('#error');
const errorMessage = document.querySelector('#error-message');
const errorPdfLink = document.querySelector('#error-pdf-link');
const pageLabel = document.querySelector('#page-label');
const canvasWrap = document.querySelector('#canvas-wrap');
const canvas = document.querySelector('#page-canvas');
const original = document.querySelector('#original-pdf');

document.querySelector('#guide-title').textContent = title;
document.title = `${title} — Krug Guide Finder`;

if (safeFile) {
  const originalUrl = `${safeFile}#page=${requestedPage}`;
  original.href = originalUrl;
  errorPdfLink.href = originalUrl;
  errorPdfLink.hidden = false;
} else {
  original.hidden = true;
}

async function render() {
  if (!safeFile) {
    throw new Error('This page link is incomplete. Return to the Model Finder and try again.');
  }

  const pdfjsLib = await import(PDFJS_URL);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const pdf = await pdfjsLib.getDocument(safeFile).promise;

  if (requestedPage > pdf.numPages) {
    throw new Error(`This guide has ${pdf.numPages} pages; PDF page ${requestedPage} is unavailable.`);
  }

  const page = await pdf.getPage(requestedPage);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2, Math.max(1, (window.innerWidth - 32) / base.width));
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the page display.');

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;

  const label = guidePage == null ? `PDF page ${requestedPage} of ${pdf.numPages}` : `Guide page ${guidePage} · PDF page ${requestedPage} of ${pdf.numPages}`;
  canvas.setAttribute('aria-label', `${title}, ${label}`);
  canvas.hidden = false;
  canvasWrap.setAttribute('aria-busy', 'false');
  pageLabel.textContent = label;
}

render().catch((err) => {
  canvasWrap.setAttribute('aria-busy', 'false');
  canvasWrap.hidden = true;
  error.hidden = false;
  errorMessage.textContent = `Unable to display this page. ${err.message}`;
  pageLabel.textContent = guidePage == null ? `PDF page ${requestedPage}` : `Guide page ${guidePage}`;
});
