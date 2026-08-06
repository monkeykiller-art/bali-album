/* BALI 2026 · API layer — talks to server.js (/api on port 8123).
   The React app is fully data-driven: pages come from pages.json and photo
   lists from the photos2 folders, so creating/removing a chapter needs no
   HTML rebuild on the server side. */

export const MAX_PAGES = 10; /* must match server.js */

async function req(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { msg = (await r.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return r.json();
}

export function fetchPages() {
  return req('/api/pages');
}
export function fetchPhotos(page) {
  return req('/api/photos?page=' + encodeURIComponent(page));
}
export function createPage(name) {
  return req('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}
export function deletePage(key) {
  return req('/api/pages?key=' + encodeURIComponent(key), { method: 'DELETE' });
}
export function renamePage(key, name) {
  return updatePage(key, { name });
}
/* whitespace is trimmed before sending, but blank entries are kept on purpose:
   an empty text field means “show a blank spot on the page”, so it must reach
   the server as an override — only an all-blank patch collapses to null
   (= clear overrides, restore defaults) */
const cleanText = v => {
  if (v === null || typeof v !== 'object') return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) out[k] = val; /* even [] — blank block override */
    else out[k] = String(val).trim();
  }
  return Object.keys(out).length ? out : null;
};
export function updatePage(key, patch) {
  const body = { key, ...patch };
  if (patch.style !== undefined && patch.style !== null) {
    const st = {};
    for (const [k, val] of Object.entries(patch.style || {})) {
      const s = String(val || '').trim();
      if (s) st[k] = s;
    }
    body.style = Object.keys(st).length ? st : null;
  }
  if (patch.copy !== undefined) body.copy = cleanText(patch.copy);
  return req('/api/pages', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
/* restore a page's birth colours and birth copy — style:null/copy:null make
   the server reset manager-created pages to NEW_PAGE_STYLE + NEW_PAGE_COPY
   (seed pages to their CSS-class look and built-in chapter text), so the
   page returns to exactly what it showed when it was created */
export function resetPage(key) {
  return updatePage(key, { style: null, copy: null });
}
export function uploadPhotos(page, files) {
  return req('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, files }),
  });
}
export function deletePhoto(page, file) {
  return req('/api/photo?page=' + encodeURIComponent(page) + '&file=' + encodeURIComponent(file), { method: 'DELETE' });
}
/* save a photo's cover crop (pass null to clear it back to cover-centre) */
export function setPhotoCrop(page, file, crop) {
  return req('/api/photo', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, file, crop }),
  });
}
export function photoUrl(page, file) {
  return '/photos2/' + encodeURIComponent(page) + '/' + encodeURIComponent(file);
}

export function fetchCoverFin() {
  return req('/api/coverfin');
}
export function updateCoverFin(key, copy) {
  return req('/api/coverfin', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, copy: cleanText(copy) }),
  });
}
