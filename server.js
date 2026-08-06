/* ═══════════ BALI 2026 · photo manager server ═══════════
   Static server for d:/project2 plus a tiny management API:
     GET    /api/pages                          list chapter pages (+ photo counts)
     POST   /api/pages   {name}                 create a new chapter page
     PATCH  /api/pages   {key,name?,style?,copy?}  rename / style / copy overrides
     DELETE /api/pages?key=<key>                remove a chapter page + its photos
     GET    /api/photos?page=<key>              list a chapter's photos
     POST   /api/upload   {page, files:[{name,data}]}  batch add (data = base64)
     DELETE /api/photo?page=<key>&file=<file>   remove one photo
     PATCH  /api/photo {page,file,crop}         save / clear a photo's crop
     GET    /api/coverfin                        list cover / fin copy overrides
     PATCH  /api/coverfin {key,copy|null}        save / clear cover or fin copy
   Page metadata lives in bali-album/pages.json (seeded from the built-in list
   on first run) and cover/fin copy overrides in bali-album/coverfin.json. The
   React album and photo manager render everything from this metadata + the
   photos2 folders, so page mutations never touch index.html — zero runtime
   dependencies, plain node.                                                   */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ALBUM = path.join(ROOT, 'bali-album');
const PHOTOS_DIR = path.join(ROOT, 'photos2');
const PAGES_JSON = path.join(ALBUM, 'pages.json');
const COVERFIN_JSON = path.join(ALBUM, 'coverfin.json');
const CROP_JSON = path.join(ALBUM, 'photos-crop.json');
const PORT = 8123;
const MAX_PAGES = 10; /* chapter pages cap — keeps the cover nav and roll tidy */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.bak': 'text/plain; charset=utf-8',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((ok, bad) => {
    let b = '';
    req.on('data', c => (b += c));
    req.on('end', () => ok(b));
    req.on('error', bad);
  });
}
function listPhotos(page) {
  const dir = path.join(PHOTOS_DIR, page);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));
}
function safeName(name) {
  let n = path.basename(String(name || '')).replace(/[\\/:*?"<>|]+/g, '-').trim();
  if (!n) return null;
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) n += '.jpg';
  return n;
}
function uniqueName(dir, name) {
  let n = name, i = 1;
  while (fs.existsSync(path.join(dir, n))) {
    const m = n.match(/^(.*?)(\.[^.]+)?$/);
    n = `${m[1]} (${i++})${m[2] || ''}`;
  }
  return n;
}

/* ---- per-photo cover crops (photos-crop.json) ----
   crop = {fx, fy, zoom}: normalized focus point (0-1) plus a zoom factor
   (1 = plain cover-centre, up to 4). Kept beside the pages metadata so the
   album and the manager render the same crop from the same source.        */
function loadCrops() {
  if (!fs.existsSync(CROP_JSON)) return {};
  try { return JSON.parse(fs.readFileSync(CROP_JSON, 'utf8')); } catch { return {}; }
}
function saveCrops(crops) {
  fs.writeFileSync(CROP_JSON, JSON.stringify(crops, null, 2));
}
function cleanCrop(v) {
  if (!v || typeof v !== 'object') return null;
  const fx = Number(v.fx), fy = Number(v.fy), zoom = Number(v.zoom);
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(zoom)) return null;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1 || zoom < 1 || zoom > 4) return null;
  return { fx: Math.round(fx * 10000) / 10000, fy: Math.round(fy * 10000) / 10000, zoom: Math.round(zoom * 100) / 100 };
}

/* ═══════════ chapter page metadata (pages.json) ═══════════
   entries: {key(folder), cls(css class), label('01'), hint(display name),
             date, region, meta, thumb}                                 */
function loadPages() {
  if (!fs.existsSync(PAGES_JSON)) return seedPagesJson();
  const list = JSON.parse(fs.readFileSync(PAGES_JSON, 'utf8'));
  if (!list.length) return seedPagesJson(); /* re-seed if the file was empty */
  list.forEach(p => { if (p.style) p.style = migrateStyle(p.style); }); /* legacy unified text -> per-element colours */
  return list;
}
function savePages(list) {
  list.forEach((p, i) => (p.label = String(i + 1).padStart(2, '0'))); /* keep numbering contiguous */
  fs.writeFileSync(PAGES_JSON, JSON.stringify(list, null, 2));
}
function pageByKey(list, key) { return list.find(p => p.key === key); }

/* first run: seed pages.json from the built-in chapter list (the React album
   renders everything from this metadata, so no HTML parsing is needed) */
function seedPagesJson() {
  const known = [
    { key: 'bromo', cls: 'bromo', hint: 'BROMO', date: '04.26', region: 'JAVA',
      meta: '01 / 05 · 04:59 · -7.937, 112.954 · <b>BROMO</b> · 火山沙海 · CONTACT SHEET 01',
      thumb: '../photos/bromo.jpg' },
    { key: 'uluwatu', cls: 'uluwatu', hint: 'ULUWATU', date: '04.30', region: 'BALI',
      meta: '02 / 05 · 18:40 · -8.829, 115.085 · <b>ULUWATU</b> · 悬崖神庙 · CONTACT SHEET 02',
      thumb: '../photos/uluwatu.jpg' },
    { key: 'ijen', cls: 'ijen', hint: 'IJEN', date: '04.27', region: 'JAVA',
      meta: '03 / 05 · 04:10 · -8.058, 114.242 · <b>IJEN</b> · 蓝色火焰 · CONTACT SHEET 03',
      thumb: '../photos/ijen.jpg' },
    { key: 'ubud', cls: 'ubud', hint: 'UBUD', date: '05.01', region: 'UBUD',
      meta: '04 / 05 · 07:20 · -8.507, 115.262 · <b>UBUD</b> · 晨雾梯田 · CONTACT SHEET 04',
      thumb: '../photos/ubud.jpg' },
    { key: 'nusa-penida', cls: 'nusapenida', hint: 'NUSA PENIDA', date: '05.02', region: 'BALI',
      meta: '05 / 05 · 10:20 · -8.727, 115.544 · <b>NUSA PENIDA</b> · 破碎海滩 · CONTACT SHEET 05',
      thumb: '../photos/nusapenida.jpg' },
  ];
  const list = known.map(k => ({ ...k, label: '00' }));
  savePages(list); /* savePages renumbers the labels 01..N */
  return list;
}

/* ═══════════ cover / fin page copy overrides (coverfin.json) ═══════════
   Two pseudo-pages (the album's first and last screens) with only text
   fields — no styles. {cover:{meta[],bali,num,cn,sub,enter,dev}}
   {fin:{rollEnd,title,cn,stats[][],line,back,dev}}. Only fields that differ
   from the built-in defaults are persisted; missing file = all defaults.   */
function loadCoverFin() {
  if (!fs.existsSync(COVERFIN_JSON)) return {};
  try { return JSON.parse(fs.readFileSync(COVERFIN_JSON, 'utf8')) || {}; }
  catch { return {}; }
}
function saveCoverFin(data) {
  fs.writeFileSync(COVERFIN_JSON, JSON.stringify(data, null, 2));
}
const COVERFIN_KEYS = {
  cover: ['meta', 'bali', 'num', 'cn', 'sub', 'enter', 'dev'],
  fin: ['rollEnd', 'title', 'cn', 'stats', 'line', 'back', 'dev'],
};
/* string fields: trimmed, script-stripped, length-capped. meta = 4 short lines,
   stats = up to 4 [value, label] pairs. Empty items are dropped so the album
   falls back to its default for that position. */
function cleanCoverFin(key, copy) {
  if (copy === null || typeof copy !== 'object') return null;
  const out = {};
  for (const k of COVERFIN_KEYS[key]) {
    const v = copy[k];
    if (v === undefined) continue;
    if (k === 'meta') {
      const arr = Array.isArray(v) ? v : [];
      const m = arr.slice(0, 4).map(s => String(s || '').trim().replace(/<script[\s\S]*?<\/script>/gi, '').slice(0, 80)).filter(Boolean);
      out.meta = m; /* empty array = show a blank block, overriding defaults */
    } else if (k === 'stats') {
      const arr = Array.isArray(v) ? v : [];
      const st = arr.slice(0, 4).map(r => {
        const b = String((r && r[0]) || '').trim().replace(/<script[\s\S]*?<\/script>/gi, '').slice(0, 20);
        const s = String((r && r[1]) || '').trim().replace(/<script[\s\S]*?<\/script>/gi, '').slice(0, 40);
        return b || s ? [b, s] : null;
      }).filter(Boolean);
      out.stats = st; /* empty array = blank stats block */
    } else {
      const s = String(v || '').trim().replace(/<script[\s\S]*?<\/script>/gi, '').slice(0, k === 'line' ? 300 : 120);
      out[k] = s; /* empty string = blank text, overriding the built-in default */
    }
  }
  return Object.keys(out).length ? out : null;
}
function updateCoverFin(key, copy) {
  if (key !== 'cover' && key !== 'fin') throw new Error('unknown cover/fin key');
  const data = loadCoverFin();
  const clean = cleanCoverFin(key, copy);
  if (clean) data[key] = clean; else delete data[key];
  saveCoverFin(data);
  return { ok: true, cover: data.cover || {}, fin: data.fin || {} };
}

/* ---- create / remove a whole chapter page (metadata + photos folder only) ---- */
function createPage(name) {
  const list = loadPages();
  if (list.length >= MAX_PAGES) throw new Error(`page limit reached (${MAX_PAGES})`);
  const clean = String(name || '').trim().replace(/[<>"'&]/g, '').slice(0, 24);
  if (!clean) throw new Error('bad name');
  let slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!slug) slug = 'chapter';
  let base = slug, i = 1;
  while (pageByKey(list, base)) base = `${slug}${++i}`;
  const n = list.length + 1;
  const nn = String(n).padStart(2, '0');
  list.push({
    key: base, cls: base, label: nn, hint: clean.toUpperCase(), date: '', region: '',
    meta: `${nn} / ${nn} · <b>${clean.toUpperCase()}</b> · NEW ROLL · CONTACT SHEET ${nn}`,
    thumb: null,
    managed: true, /* born with NEW_PAGE_STYLE — “restore defaults” returns here */
    style: { ...NEW_PAGE_STYLE },
    copy: { ...NEW_PAGE_COPY, timeline: NEW_PAGE_COPY.timeline.map(r => [...r]) },
  });
  savePages(list);
  fs.mkdirSync(path.join(PHOTOS_DIR, base), { recursive: true });
  return { ok: true, page: list[list.length - 1], pages: list };
}
/* ---- update a chapter page: rename and/or style/copy overrides. key stays
      stable so photos, CSS class and API references never break. style: hex
      colours {line,bg} + one field per text element (titleColor, kickerColor,
      cnColor, taglineColor, quoteColor, quoteCnColor, spotColor, btagColor,
      tlColor); copy: free-text fields from the chapter card
      (null clears overrides back to the hard-coded defaults) ---- */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const COPY_KEYS = ['title', 'kicker', 'cn', 'tagline', 'quote', 'quoteCn', 'spot', 'btagline'];
/* per-element text colours (the old unified style.text is migrated into these) */
const TEXT_COLOR_KEYS = ['titleColor', 'kickerColor', 'cnColor', 'taglineColor', 'quoteColor', 'quoteCnColor', 'spotColor', 'btagColor', 'tlColor'];
const STYLE_KEYS = ['text', 'line', 'bg', 'stampColor', ...TEXT_COLOR_KEYS];
/* defaults applied to every newly created page: grey background + white ink,
   so the chapter card is readable immediately and the manager page opens
   with every field pre-filled */
const NEW_PAGE_STYLE = {
  bg: '#707070', line: '#ffffff', stampColor: '#ffffff',
  titleColor: '#ffffff', kickerColor: '#ffffff', cnColor: '#ffffff',
  taglineColor: '#ffffff', quoteColor: '#ffffff', quoteCnColor: '#ffffff',
  spotColor: '#ffffff', btagColor: '#ffffff', tlColor: '#ffffff',
};
const NEW_PAGE_COPY = {
  title: 'TITLE', kicker: 'KICKER', cn: 'CN', tagline: 'TAGLINE',
  quote: 'QUOTE', quoteCn: 'QUOTE-CN', spot: 'SPOT', btagline: 'B-TAGLINE',
  timeline: [['TIMELINE', 'TIMELINE']],
};
/* pages seeded from the built-in chapter list have their own CSS-class
   colours in styles.css; every other page was created through the manager
   and was born with NEW_PAGE_STYLE — “restore defaults” must return each
   page to its own birth colours, never another page's look */
const SEED_KEYS = ['bromo', 'uluwatu', 'ijen', 'ubud', 'nusa-penida'];
const isManaged = p => p.managed === true || !SEED_KEYS.includes(p.key);
/* migrate a legacy unified text colour into the 9 per-element fields so old
   saves keep working; explicit per-element values always win */
function migrateStyle(style) {
  if (style && style.text) {
    for (const k of TEXT_COLOR_KEYS) if (!style[k]) style[k] = style.text;
    delete style.text;
  }
  return style;
}
function cleanCopy(v) {
  if (v === null || typeof v !== 'object') return null;
  const out = {};
  for (const k of COPY_KEYS) {
    if (v[k] === undefined) continue;
    const s = String(v[k] || '').trim().replace(/<script[\s\S]*?<\/script>/gi, '').slice(0, 300);
    out[k] = s;
  }
  if (v.timeline !== undefined) {
    const tl = Array.isArray(v.timeline) ? v.timeline : [];
    out.timeline = tl.slice(0, 6).map(r => {
      const t = String((r && r[0]) || '').trim().slice(0, 20);
      const s = String((r && r[1]) || '').trim().slice(0, 60);
      return t || s ? [t, s] : null;
    }).filter(Boolean);
  }
  return Object.keys(out).length ? out : null;
}
function updatePage(key, patch) {
  const list = loadPages();
  const p = pageByKey(list, key);
  if (!p) throw new Error('unknown page');
  if (patch.name !== undefined) {
    const clean = String(patch.name || '').trim().replace(/[<>"'&]/g, '').slice(0, 24);
    if (!clean) throw new Error('bad name');
    const upper = clean.toUpperCase();
    p.hint = upper;
    p.meta = String(p.meta || '').replace(/<b>[^<]*<\/b>/, '<b>' + upper + '<\/b>');
  }
  if (patch.style !== undefined) {
    if (patch.style === null) {
      /* restore the page's birth colours instead of falling back to another
         page's look: manager-created pages were born with NEW_PAGE_STYLE,
         pre-built seed pages with their CSS-class colours */
      p.style = isManaged(p) ? { ...NEW_PAGE_STYLE } : undefined;
    } else {
      const st = migrateStyle(patch.style && typeof patch.style === 'object' ? patch.style : null);
      const out = {};
      for (const k of STYLE_KEYS) {
        if (st && st[k]) {
          const c = String(st[k]).trim();
          if (!HEX.test(c)) throw new Error('bad colour: ' + k);
          out[k] = c.toLowerCase();
        }
      }
      p.style = Object.keys(out).length ? out : undefined;
    }
  }
  if (patch.copy !== undefined) {
    if (patch.copy === null) {
      /* restore the page's birth copy: manager-created pages were born with
         NEW_PAGE_COPY, pre-built seed pages with their built-in chapter text */
      p.copy = isManaged(p)
        ? { ...NEW_PAGE_COPY, timeline: NEW_PAGE_COPY.timeline.map(r => [...r]) }
        : undefined;
    } else {
      const c = cleanCopy(patch.copy);
      p.copy = c || undefined;
    }
  }
  savePages(list);
  return { ok: true, page: p, pages: list };
}
function deletePage(key) {
  const list = loadPages();
  const p = pageByKey(list, key);
  if (!p) throw new Error('unknown page');
  const dir = path.join(PHOTOS_DIR, key);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  const crops = loadCrops();
  if (crops[key]) { delete crops[key]; saveCrops(crops); }
  const out = list.filter(x => x.key !== key);
  savePages(out);
  return { ok: true, removed: key, pages: out };
}

/* ---- http server ---- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p.startsWith('/api/')) {
      if (p === '/api/pages' && req.method === 'GET') {
        const list = loadPages();
        return send(res, 200, JSON.stringify({
          pages: list.map(x => ({ ...x, count: listPhotos(x.key).length })),
          defaultStyle: NEW_PAGE_STYLE, /* the birth colours of manager-created pages */
        }), 'application/json; charset=utf-8');
      }
      if (p === '/api/pages' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req) || '{}');
        if (loadPages().length >= MAX_PAGES) {
          return send(res, 400, JSON.stringify({ ok: false, error: `page limit reached (${MAX_PAGES})` }), 'application/json; charset=utf-8');
        }
        const r = createPage(body.name);
        return send(res, 200, JSON.stringify(r), 'application/json; charset=utf-8');
      }
      if (p === '/api/pages' && req.method === 'DELETE') {
        const key = url.searchParams.get('key');
        const r = deletePage(key);
        return send(res, 200, JSON.stringify(r), 'application/json; charset=utf-8');
      }
      if (p === '/api/pages' && req.method === 'PATCH') {
        const body = JSON.parse(await readBody(req) || '{}');
        const r = updatePage(body.key, body);
        return send(res, 200, JSON.stringify(r), 'application/json; charset=utf-8');
      }
      if (p === '/api/photos' && req.method === 'GET') {
        const page = url.searchParams.get('page');
        if (!pageByKey(loadPages(), page)) return send(res, 400, 'unknown page');
        const crops = loadCrops();
        return send(res, 200, JSON.stringify({ page, photos: listPhotos(page), crops: crops[page] || {} }), 'application/json; charset=utf-8');
      }
      if (p === '/api/upload' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req) || '{}');
        const page = body.page;
        if (!pageByKey(loadPages(), page)) return send(res, 400, 'unknown page');
        const dir = path.join(PHOTOS_DIR, page);
        fs.mkdirSync(dir, { recursive: true });
        const saved = [];
        for (const f of (body.files || [])) {
          const name = safeName(f && f.name);
          if (!name) continue;
          const fn = uniqueName(dir, name);
          fs.writeFileSync(path.join(dir, fn), Buffer.from(String(f.data || ''), 'base64'));
          saved.push(fn);
        }
        return send(res, 200, JSON.stringify({ ok: true, saved, photos: listPhotos(page) }), 'application/json; charset=utf-8');
      }
      if (p === '/api/coverfin' && req.method === 'GET') {
        const d = loadCoverFin();
        return send(res, 200, JSON.stringify({ cover: d.cover || {}, fin: d.fin || {} }), 'application/json; charset=utf-8');
      }
      if (p === '/api/coverfin' && req.method === 'PATCH') {
        const body = JSON.parse(await readBody(req) || '{}');
        const r = updateCoverFin(body.key, body.copy);
        return send(res, 200, JSON.stringify(r), 'application/json; charset=utf-8');
      }
      if (p === '/api/photo' && req.method === 'DELETE') {
        const page = url.searchParams.get('page');
        const file = url.searchParams.get('file');
        if (!pageByKey(loadPages(), page)) return send(res, 400, 'unknown page');
        const name = safeName(file);
        if (!name || name !== path.basename(file)) return send(res, 400, 'bad file name');
        const fp = path.join(PHOTOS_DIR, page, name);
        if (!fs.existsSync(fp)) return send(res, 404, 'file not found');
        fs.unlinkSync(fp);
        const crops = loadCrops();
        if (crops[page] && crops[page][name]) {
          delete crops[page][name];
          if (!Object.keys(crops[page]).length) delete crops[page];
          saveCrops(crops);
        }
        return send(res, 200, JSON.stringify({ ok: true, removed: name, photos: listPhotos(page) }), 'application/json; charset=utf-8');
      }
      if (p === '/api/photo' && req.method === 'PATCH') {
        const body = JSON.parse(await readBody(req) || '{}');
        const page = body.page;
        if (!pageByKey(loadPages(), page)) return send(res, 400, 'unknown page');
        const name = safeName(body.file);
        if (!name || name !== path.basename(String(body.file || ''))) return send(res, 400, 'bad file name');
        const fp = path.join(PHOTOS_DIR, page, name);
        if (!fs.existsSync(fp)) return send(res, 404, 'file not found');
        const crops = loadCrops();
        const crop = cleanCrop(body.crop);
        if (crop) {
          (crops[page] = crops[page] || {})[name] = crop;
        } else if (crops[page]) {
          delete crops[page][name];
          if (!Object.keys(crops[page]).length) delete crops[page];
        }
        saveCrops(crops);
        return send(res, 200, JSON.stringify({ ok: true, file: name, crop, crops: crops[page] || {} }), 'application/json; charset=utf-8');
      }
      return send(res, 404, 'unknown api');
    }

    /* static files under ROOT */
    let fp = path.normalize(path.join(ROOT, decodeURIComponent(p)));
    if (!fp.startsWith(ROOT)) return send(res, 403, 'forbidden');
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) {
      fp = path.join(fp, 'index.html');
    }
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) return send(res, 404, '404');
    const ext = path.extname(fp).toLowerCase();
    send(res, 200, fs.readFileSync(fp), MIME[ext] || 'application/octet-stream');
  } catch (e) {
    send(res, 500, 'server error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`BALI 2026 manager running at http://localhost:${PORT}/bali-album/index.html`);
  console.log(`Admin UI: http://localhost:${PORT}/bali-album/admin.html`);
});
