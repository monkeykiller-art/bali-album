/* unified album manager — text & style config + photo management in one
   three-column layout: page list | tabbed editor | live preview.
   Text side saves through PATCH /api/pages {style, copy} (+ /api/coverfin
   for the cover/fin pseudo-pages); photo side reuses the photo panel's
   upload / grid CRUD / add-rename-delete workflows. The preview renders the
   real album components (Cover / Chapter / Fin), so every draft colour,
   copy field and photo change shows up instantly without leaving the page. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_PAGES, createPage, deletePage, deletePhoto, fetchCoverFin, fetchPages, fetchPhotos, photoUrl, renamePage, resetPage, setPhotoCrop, updatePage, updateCoverFin, uploadPhotos } from '../../api';
import { CROP_MAX_ZOOM, defaultCrop, isDefaultCrop, cropStyle, windowRectOf } from '../../crop';
import { chapterOf } from '../../data';
import { COVER_DEFAULT, FIN_DEFAULT } from '../../coverfin';
import Modal from './Modal';
import PhotoPanel from './AdminApp';
import Stamp, { StampDefs } from '../Stamp';
import Cover from '../Cover';
import Fin from '../Fin';
import Chapter from '../Chapter';

const noop = () => {}; /* preview pages: navigation is inert */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/* user-facing text must never leak markup — strip tags and decode the common
   entities, so the manager always shows the same plain words the album prints */
const stripHtml = s => String(s || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

const BG_LINE_FIELDS = [
  ['bg', '页面背景', 'BACKGROUND'],
  ['line', '线条颜色', 'LINE'],
];
/* postmark ink — lives with the page-level colours (bg/line), not the text ones */
const STAMP_FIELDS = [
  ['stampColor', '邮戳颜色', 'STAMP COLOR'],
];
/* one colour per text element — maps 1:1 onto the --t-*-color CSS variables */
const TEXT_COLOR_FIELDS = [
  ['titleColor', '页面标题', 'TITLE'],
  ['kickerColor', '眉题', 'KICKER'],
  ['cnColor', '中文名', 'CN'],
  ['taglineColor', '标语', 'TAGLINE'],
  ['quoteColor', '引言', 'QUOTE'],
  ['quoteCnColor', '引言中文', 'QUOTE-CN'],
  ['spotColor', '角标', 'SPOT'],
  ['btagColor', '照片区标语', 'B-TAGLINE'],
  ['tlColor', '时间线', 'TIMELINE'],
];
const ALL_COLOR_FIELDS = [...BG_LINE_FIELDS, ...STAMP_FIELDS, ...TEXT_COLOR_FIELDS];
const COPY_FIELDS = [
  ['title', '页面标题 TITLE'],
  ['kicker', '眉题 KICKER'],
  ['cn', '中文名 CN'],
  ['tagline', '标语 TAGLINE'],
  ['quote', '引言 QUOTE'],
  ['quoteCn', '引言中文 QUOTE-CN'],
  ['spot', '角标 SPOT'],
  ['btagline', '照片区标语 B-TAGLINE'],
];

/* cover / fin pseudo-page fields — text-only, no colours. Array fields
   (meta / stats) are edited as multi-line text (one entry per line, stats
   rows as “value label”) and serialised back to arrays on save */
const COVER_CF_FIELDS = [
  ['meta', '顶部信息', 'META · 每行一条'],
  ['bali', '大标题', 'BALI'],
  ['num', '年份数字', 'YEAR'],
  ['cn', '中文副标', 'CN'],
  ['sub', '英文副标语', 'SUBTITLE'],
  ['enter', '进入按钮', 'ENTER'],
  ['dev', '开发信息', 'DEV'],
];
const FIN_CF_FIELDS = [
  ['rollEnd', '卷尾标语', 'ROLL END'],
  ['title', '标题', 'TITLE'],
  ['cn', '中文标题', 'CN'],
  ['stats', '统计数据', 'STATS · 每行：数字 标签'],
  ['line', '结束语', 'FIN LINE'],
  ['back', '返回按钮', 'BACK'],
  ['dev', '开发信息', 'DEV'],
];
const cfFieldsOf = kind => (kind === 'cover' ? COVER_CF_FIELDS : FIN_CF_FIELDS);
const cfDefaultOf = kind => (kind === 'cover' ? COVER_DEFAULT : FIN_DEFAULT);

/* placeholder for a pseudo-page field — the built-in default (multi-line for
   array fields), shown while the box is blank so the user knows what the
   album would display if the blank override is kept */
const cfPlaceholderOf = (kind, k) => {
  const def = cfDefaultOf(kind)[k];
  return Array.isArray(def)
    ? def.map(it => (Array.isArray(it) ? it.join(' ') : String(it))).join('\n')
    : String(def);
};

/* editing values for a pseudo-page: saved overrides win per field — a saved
   blank stays blank, so the editor shows exactly what the album displays;
   array fields become multi-line strings */
const cfDraftOf = (kind, data) => {
  const def = cfDefaultOf(kind);
  const saved = (data && data[kind]) || {};
  const copy = {};
  for (const [k] of cfFieldsOf(kind)) {
    const cur = saved[k];
    if (Array.isArray(def[k])) {
      const arr = Array.isArray(cur) ? cur : null;
      copy[k] = Array.from({ length: def[k].length }, (_, i) => {
        const it = (arr && arr[i]) || null;
        if (Array.isArray(def[k][i])) {
          const b = arr ? String((it && it[0]) || '').trim() : def[k][i][0];
          const s = arr ? String((it && it[1]) || '').trim() : def[k][i][1];
          return b + ' ' + s;
        }
        return arr ? String(it || '').trim() : def[k][i];
      }).join('\n');
    } else {
      copy[k] = cur != null ? String(cur).trim() : def[k];
    }
  }
  return { kind, copy };
};
/* parse an array field (meta lines / stats rows) back to its array shape;
   empty items stay empty so the album renders that position as blank */
const cfArrOf = (kind, k, v) => {
  const def = cfDefaultOf(kind)[k];
  const lines = String(v || '').split('\n');
  return def.map((item, i) => {
    const raw = String(lines[i] || '').trim();
    if (Array.isArray(item)) {
      const parts = raw.split(/\s+/).filter(Boolean);
      return [parts[0] || '', parts.slice(1).join(' ') || ''];
    }
    return raw;
  });
};
/* full copy object for the live preview — every field resolved to its final
   value (draft or default), arrays in the same shape the album renders;
   blank fields stay blank instead of falling back to defaults */
const cfFullOf = (kind, draft) => {
  const def = cfDefaultOf(kind);
  const copy = {};
  for (const [k] of cfFieldsOf(kind)) {
    if (Array.isArray(def[k])) copy[k] = cfArrOf(kind, k, draft && draft.copy[k]);
    else copy[k] = String((draft && draft.copy[k]) || '').trim();
  }
  return copy;
};
/* persist only what differs from the built-in defaults, so coverfin.json
   stays clean and “restore defaults” keeps its meaning; a blank field is a
   real override — it renders as an empty spot on the page */
const buildCfCopy = (kind, draft) => {
  const def = cfDefaultOf(kind);
  const copy = {};
  for (const [k] of cfFieldsOf(kind)) {
    const v = String((draft && draft.copy[k]) || '');
    if (Array.isArray(def[k])) {
      const arr = cfArrOf(kind, k, v);
      if (JSON.stringify(arr) !== JSON.stringify(def[k])) copy[k] = arr;
    } else {
      const s = String(v).trim();
      if (s !== String(def[k])) copy[k] = s;
    }
  }
  return copy;
};

/* editing values are pre-filled from the page's current copy (saved overrides
   win — a saved blank shows as an empty box — otherwise the hard-coded
   defaults via chapterOf), so the manager always shows what the album
   actually displays and edits start from the live text */
const draftOf = p => {
  const base = chapterOf(p);
  const st = p.style || {};
  return {
    style: Object.fromEntries(ALL_COLOR_FIELDS.map(([k]) => [k, st[k] || ''])),
    copy: Object.fromEntries(COPY_FIELDS.map(([k]) => [k,
      stripHtml(p.copy && p.copy[k] != null ? p.copy[k] : (base[k] != null ? String(base[k]) : ''))])),
    timeline: (p.copy && p.copy.timeline)
      || base.timeline.map(([, t, s]) => [t, s]),
  };
};

export default function TextConfig() {
  const [pages, setPages] = useState([]);
  const [cur, setCur] = useState('');
  const [sel, setSel] = useState({});        /* batch checkboxes: key -> true */
  const [draft, setDraft] = useState(null);  /* editing values */
  const [saved, setSaved] = useState(null);  /* last persisted snapshot (JSON) */
  const [cf, setCf] = useState(null);        /* cover/fin saved overrides */
  const [cfKey, setCfKey] = useState(null);  /* 'cover' | 'fin' | null (chapter mode) */
  const [cfDraft, setCfDraft] = useState(null); /* pseudo-page editing values */
  const [cfSaved, setCfSaved] = useState(null); /* last pseudo-page snapshot (JSON) */
  const [tab, setTab] = useState('text');    /* editor tab: 'text' | 'photos' */
  const [photos, setPhotos] = useState([]);  /* photos of the selected chapter (grid + preview) */
  const [crops, setCrops] = useState({});    /* file -> {fx,fy,zoom} of the selected chapter */
  const [cropTarget, setCropTarget] = useState(null); /* {file, crop} while the crop tool is open */
  const [counts, setCounts] = useState({});  /* pageKey -> photo count */
  const [errs, setErrs] = useState({});
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const modalResolve = useRef(null);         /* Promise-style ask() */
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);   /* fullscreen preview overlay */

  const page = pages.find(p => p.key === cur);
  const data = page ? chapterOf(page) : null;

  const toastNow = useCallback((msg, kind) => setToast({ msg, kind: kind || '' }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  /* Promise-style ask(): the modal renders while the caller awaits */
  const ask = useCallback(opts => new Promise(res => { modalResolve.current = res; setModal(opts); }), []);
  const closeModal = useCallback(v => {
    if (modalResolve.current) modalResolve.current(v);
    modalResolve.current = null;
    setModal(null);
  }, []);

  const loadPhotos = useCallback(async key => {
    if (!key) { setPhotos([]); return; }
    try {
      const r = await fetchPhotos(key);
      const list = (r && r.photos) || [];
      setPhotos(list);
      setCrops((r && r.crops) || {});
      setCounts(m => ({ ...m, [key]: list.length }));
    } catch (e) {
      toastNow('照片加载失败: ' + e.message, 'err');
    }
  }, [toastNow]);

  useEffect(() => {
    fetchPages()
      .then(d => {
        const list = (d && d.pages) || [];
        setPages(list);
        setCounts(Object.fromEntries((d && d.pages || []).map(p => [p.key, p.count || 0])));
        if (list.length) {
          setCur(list[0].key);
          const s = draftOf(list[0]);
          setDraft(s);
          setSaved(JSON.stringify(s));
          loadPhotos(list[0].key);
        }
      })
      .catch(() => toastNow('页面列表加载失败', 'err'));
    fetchCoverFin()
      .then(d => setCf(d || {}))
      .catch(() => setCf({}));
  }, []);

  /* fullscreen preview: Esc closes it and the page behind stops scrolling */
  useEffect(() => {
    if (!full) return;
    const onKey = e => { if (e.key === 'Escape') setFull(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const select = key => {
    const p = pages.find(x => x.key === key);
    if (!p) return;
    setCur(key);
    setCfKey(null);
    const s = draftOf(p);
    setDraft(s);
    setSaved(JSON.stringify(s));
    setErrs({});
    loadPhotos(key);
  };

  /* pseudo-page editing: cover / fin have only text fields — the manager
     switches to the text-only panel and hides the style/preview panes */
  const selectCf = kind => {
    setCur('');
    setCfKey(kind);
    setTab('text'); /* pseudo-pages have no photo management */
    setPhotos([]);
    const s = cfDraftOf(kind, cf);
    setCfDraft(s);
    setCfSaved(JSON.stringify(s));
    setErrs({});
  };

  /* after add / delete / rename: re-fetch metadata and reselect a page, so
     the list, draft and photo state always follow the server truth */
  const reloadPages = useCallback(async keepKey => {
    const d = await fetchPages();
    const list = (d && d.pages) || [];
    setPages(list);
    setCounts(Object.fromEntries(list.map(p => [p.key, p.count || 0])));
    const key = list.some(p => p.key === keepKey) ? keepKey : (list.length ? list[0].key : '');
    setCur(key);
    setCfKey(null);
    if (key) {
      const p = list.find(x => x.key === key);
      const s = draftOf(p);
      setDraft(s);
      setSaved(JSON.stringify(s));
      loadPhotos(key);
    } else {
      setDraft(null); setSaved(null); setPhotos([]);
    }
    setErrs({});
  }, [loadPhotos]);

  /* ---- photo workflows (upload / delete photo / add / rename / delete page) ---- */
  const handleUpload = async items => {
    try {
      const res = await uploadPhotos(cur, items);
      toastNow(`已添加 ${res.saved.length} 张照片到 ${page ? page.hint : ''}`, 'ok');
      await loadPhotos(cur);
    } catch (e) {
      toastNow('上传失败: ' + e.message, 'err');
    }
  };
  const handleDeletePhoto = async f => {
    const ok = await ask({
      title: '删除照片',
      msg: `确定从 ${page ? page.hint : ''} 删除「${f}」？\n相册页面将同步更新。`,
      input: false, okText: '删除', danger: true,
    });
    if (!ok) return;
    try {
      await deletePhoto(cur, f);
      toastNow('已删除 ' + f, 'ok');
      await loadPhotos(cur);
    } catch (e) {
      toastNow('删除失败: ' + e.message, 'err');
    }
  };
  /* save (or clear) a photo's crop — the album renders the same value the
     crop tool previewed, so what the user frames is exactly what shows up */
  const handleSaveCrop = async (file, crop) => {
    try {
      const r = await setPhotoCrop(cur, file, crop);
      setCrops((r && r.crops) || {});
      setCropTarget(null);
      toastNow(crop ? '已保存裁剪' : '已恢复原始显示', 'ok');
    } catch (e) {
      toastNow('保存裁剪失败: ' + e.message, 'err');
    }
  };
  const handleAddPage = async () => {
    if (pages.length >= MAX_PAGES) {
      toastNow(`已达页面数量上限（${MAX_PAGES} 个），请先删除其他页面`, 'err');
      return;
    }
    const name = await ask({
      title: '＋ 新增页面',
      msg: '输入新页面名称（英文，如 KOMODO）。\n创建后相册封面的导航与索引会同步更新。',
      placeholder: '如 KOMODO',
      okText: '创建',
      validate: v => (/[<>"'&]/.test(v) ? '名称不能包含 < > " \' & 等字符' : null),
    });
    if (!name) return;
    try {
      const res = await createPage(name);
      toastNow('已创建页面 ' + res.page.hint, 'ok');
      await reloadPages(res.page.key);
    } catch (e) {
      toastNow('创建失败: ' + e.message, 'err');
    }
  };
  const handleDeletePage = async () => {
    if (!page) return;
    const ok = await ask({
      title: '删除页面',
      msg: `确定删除 ${page.hint}（${page.label}）？\n该页面的所有照片将一并删除，且不可恢复！`,
      input: false, okText: '确认删除', danger: true,
    });
    if (!ok) return;
    try {
      await deletePage(page.key);
      toastNow('已删除页面 ' + page.label, 'ok');
      await reloadPages('');
    } catch (e) {
      toastNow('删除失败: ' + e.message, 'err');
    }
  };
  const handleRenamePage = async () => {
    if (!page) return;
    const name = await ask({
      title: '✎ 重命名页面',
      msg: `将「${page.hint}」重命名为：\n（相册封面导航、章节标题与索引将同步更新）`,
      placeholder: '如 KOMODO',
      okText: '保存',
      validate: v => (/[<>"'&]/.test(v) ? '名称不能包含 < > " \' & 等字符' : null),
    });
    if (!name) return;
    try {
      const res = await renamePage(cur, name);
      toastNow('已重命名页面为 ' + res.page.hint, 'ok');
      await reloadPages(cur);
    } catch (e) {
      toastNow('重命名失败: ' + e.message, 'err');
    }
  };

  const setColor = (k, v) => {
    const val = String(v).trim();
    setErrs(e => ({ ...e, [k]: (val && !HEX.test(val)) ? '格式应为 #RGB 或 #RRGGBB' : '' }));
    setDraft(d => ({ ...d, style: { ...d.style, [k]: v } }));
  };

  /* one colour row: picker + hex input + per-element reset (×) */
  const colorRow = ([k, cn, en]) => (
    <label key={k} className={'cfield' + (errs[k] ? ' err' : '')}>
      <span className="lab">{cn}<em>{en}</em></span>
      <input type="color" value={normalizeColor((draft && draft.style[k]) || '')}
        onChange={e => setColor(k, e.target.value)} />
      <input type="text" className="hex" placeholder="#RRGGBB"
        value={(draft && draft.style[k]) || ''}
        onChange={e => setColor(k, e.target.value)} />
      <button type="button" className="cx" title="恢复该元素默认颜色"
        onClick={() => setColor(k, '')}>×</button>
      {errs[k] && <b className="e">{errs[k]}</b>}
    </label>
  );
  const setCopy = (k, v) => setDraft(d => ({ ...d, copy: { ...d.copy, [k]: v } }));
  const setCfCopy = (k, v) => setCfDraft(d => ({ ...d, copy: { ...d.copy, [k]: v } }));
  const setTimeline = (i, part, v) => setDraft(d => {
    const tl = d.timeline.map(r => [...r]);
    while (tl.length <= i) tl.push(['', '']);
    tl[i][part] = v;
    return { ...d, timeline: tl };
  });
  /* whitespace-only inputs are cleared on blur: a blank field means “show a
     blank spot on the page”, so stray spaces must not linger in the editor,
     the preview or the saved payload */
  const blurCopy = k => setDraft(d => {
    const v = String((d && d.copy && d.copy[k]) || '').trim();
    return d.copy[k] === v ? d : { ...d, copy: { ...d.copy, [k]: v } };
  });
  const blurCfCopy = k => setCfDraft(d => {
    const v = String((d && d.copy && d.copy[k]) || '').trim();
    return d.copy[k] === v ? d : { ...d, copy: { ...d.copy, [k]: v } };
  });
  const blurTimeline = i => setDraft(d => {
    const tl = d.timeline.map(([t, s]) => [String(t || '').trim(), String(s || '').trim()]);
    return JSON.stringify(tl) === JSON.stringify(d.timeline) ? d : { ...d, timeline: tl };
  });
  const addTimeline = () => setDraft(d => ({ ...d, timeline: [...d.timeline, ['', '']] }));
  const delTimeline = i => setDraft(d => ({ ...d, timeline: d.timeline.filter((_, j) => j !== i) }));

  const validate = () => {
    const e = {};
    for (const [k] of ALL_COLOR_FIELDS) {
      const v = String((draft && draft.style[k]) || '').trim();
      if (v && !HEX.test(v)) e[k] = '格式应为 #RGB 或 #RRGGBB';
    }
    setErrs(e);
    return !Object.keys(e).length;
  };

  const buildStyle = () => {
    const style = {};
    for (const [k] of ALL_COLOR_FIELDS) {
      const v = String((draft && draft.style[k]) || '').trim();
      if (v) style[k] = v;
    }
    return style;
  };
  /* only fields that differ from the chapter defaults are persisted, so pages
     with no copy overrides stay clean and “restore defaults” stays meaningful;
     a blank field differs from its default and is kept — the page then shows
     an empty spot instead of the built-in text */
  const buildCopy = () => {
    if (!page || !draft) return {};
    const base = chapterOf(page);
    const copy = {};
    for (const [k] of COPY_FIELDS) {
      const v = String((draft && draft.copy[k]) || '').trim();
      const def = base[k] == null ? '' : stripHtml(String(base[k])).trim();
      if (v !== def) copy[k] = v;
    }
    const tl = (draft && draft.timeline || [])
      .map(([t, s]) => [String(t || '').trim(), String(s || '').trim()])
      .filter(([t, s]) => t || s);
    const defTl = base.timeline ? base.timeline.map(([, t, s]) => [t, s]) : [];
    if (JSON.stringify(tl) !== JSON.stringify(defTl)) copy.timeline = tl;
    return copy;
  };

  const save = async () => {
    if (!page || !draft) return;
    if (!validate()) { toastNow('颜色格式有误，请检查输入', 'err'); return; }
    setBusy(true);
    try {
      const res = await updatePage(cur, { style: buildStyle(), copy: buildCopy() });
      const s = draftOf(res.page);
      setDraft(s);
      setSaved(JSON.stringify(s));
      setPages(ps => ps.map(p => (p.key === cur ? res.page : p)));
      toastNow(`已保存「${res.page.hint}」的文字与样式`, 'ok');
    } catch (e) {
      toastNow('保存失败: ' + e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  /* pseudo-page save: only text fields go to /api/coverfin, nothing else */
  const saveCf = async () => {
    if (!cfKey || !cfDraft) return;
    setBusy(true);
    try {
      const res = await updateCoverFin(cfKey, buildCfCopy(cfKey, cfDraft));
      setCf({ cover: res.cover, fin: res.fin });
      const s = cfDraftOf(cfKey, res);
      setCfDraft(s);
      setCfSaved(JSON.stringify(s));
      toastNow(`已保存「${cfKey === 'cover' ? '封面' : '尾页'}」的文字内容`, 'ok');
    } catch (e) {
      toastNow('保存失败: ' + e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (cfKey) {
      if (!cfSaved) return;
      setCfDraft(JSON.parse(cfSaved));
      setErrs({});
      toastNow('已撤销到上次保存的状态', 'ok');
      return;
    }
    if (!saved) return;
    setDraft(JSON.parse(saved));
    setErrs({});
    toastNow('已撤销到上次保存的状态', 'ok');
  };

  const askReset = async () => {
    const ok = await ask({
      title: '恢复默认',
      msg: cfKey
        ? `确定恢复「${cfKey === 'cover' ? '封面' : '尾页'}」的默认文案？\n所有自定义文字将被清除。`
        : `确定恢复「${page.hint}」的默认样式与文案？\n颜色与文字将恢复为创建时的初始状态。`,
      input: false, okText: '恢复默认', danger: true,
    });
    if (ok) doReset();
  };
  const doReset = async () => {
    setBusy(true);
    try {
      if (cfKey) {
        const res = await updateCoverFin(cfKey, null);
        setCf({ cover: res.cover, fin: res.fin });
        const s = cfDraftOf(cfKey, res);
        setCfDraft(s);
        setCfSaved(JSON.stringify(s));
        toastNow(`「${cfKey === 'cover' ? '封面' : '尾页'}」已恢复默认`, 'ok');
      } else {
        if (!page) return;
        /* style:null + copy:null make the server restore this page's birth
           colours and birth copy (NEW_PAGE_STYLE + NEW_PAGE_COPY for
           manager-created pages, CSS-class look + built-in chapter text for
           the pre-built seed pages) — never another page's configuration */
        const res = await resetPage(cur);
        const s = draftOf(res.page);
        setDraft(s);
        setSaved(JSON.stringify(s));
        setPages(ps => ps.map(p => (p.key === cur ? res.page : p)));
        toastNow(`「${res.page.hint}」已恢复默认`, 'ok');
      }
    } catch (e) {
      toastNow('重置失败: ' + e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  /* batch: apply the current colour draft to every checked page (copy untouched) */
  const batchApply = async () => {
    const keys = Object.keys(sel).filter(k => sel[k]);
    if (!keys.length) { toastNow('请先勾选要批量应用的页面', 'err'); return; }
    if (!validate()) { toastNow('颜色格式有误，请检查输入', 'err'); return; }
    const style = buildStyle();
    if (!Object.keys(style).length) { toastNow('请先设置至少一个颜色', 'err'); return; }
    setBusy(true);
    let ok = 0, fail = 0;
    for (const k of keys) {
      try { await updatePage(k, { style }); ok++; }
      catch { fail++; }
    }
    try {
      const d = await fetchPages();
      setPages((d && d.pages) || []);
    } catch { /* keep local list */ }
    toastNow(`批量应用完成：${ok} 个页面成功${fail ? '，' + fail + ' 个失败' : ''}`, fail ? 'err' : 'ok');
    setBusy(false);
  };

  /* live preview: the real Chapter component with the current draft merged
     into the page metadata — uncommitted colours and copy render exactly as
     they will after save (blank fields show as blank spots on the page) */
  const previewPage = page && draft ? {
    ...page,
    style: Object.keys(buildStyle()).length ? buildStyle() : undefined,
    copy: (() => {
      const c = {};
      for (const [k] of COPY_FIELDS) {
        c[k] = String(draft.copy[k] || '').trim();
      }
      const tl = draft.timeline.filter(([t, s]) => t || s).map(([t, s]) => [String(t).trim(), String(s).trim()]);
      c.timeline = tl;
      return c;
    })(),
  } : page;

  /* the same live components render in the side pane and the fullscreen
     overlay, so both stay pixel-identical and edit → preview stays instant.
     The side pane renders simplified (first shot only, no thumb strip /
     counter); the fullscreen overlay keeps every navigation control. */
  const previewInner = simplified => cfKey === 'cover' ? (
    <Cover chapters={pages} goto={noop} firsts={null} copy={cfFullOf('cover', cfDraft)} />
  ) : cfKey === 'fin' ? (
    <Fin goto={noop} copy={cfFullOf('fin', cfDraft)} />
  ) : page ? (
    <Chapter p={previewPage} photos={photos} crops={crops} active onLoad={noop} preview={simplified} />
  ) : (
    <p className="tip">请先在左侧选择页面</p>
  );


  return (
    <>
      <header>
        <div className="brand"><b>ALBUM</b> MANAGER</div>
        <span className="hlnk">
          <a href="index.html">← 返回相册</a>
        </span>
      </header>
      <main id="tcfg">
        <aside id="plist">
          <h3>页面选择</h3>
          <p className="tip">勾选章节可批量应用颜色；封面/尾页仅编辑文字。</p>
          <p className="sub">封面与尾页<em>纯文字编辑</em></p>
          {['cover', 'fin'].map(k => {
            const over = !!(cf && cf[k] && Object.keys(cf[k]).length);
            return (
              <div key={k} className={'it cf' + (cfKey === k ? ' on' : '')}>
                <button type="button" onClick={() => selectCf(k)}>
                  {over && <span className="dot" title="已自定义文字内容"></span>}
                  {k === 'cover' ? '封面' : '尾页'}
                  <em>{k === 'cover' ? 'COVER' : 'FIN'}</em>
                </button>
              </div>
            );
          })}
          <p className="sub">章节页面<em>样式 + 文字</em></p>
          {pages.map(p => {
            const custom = !!(p.style || p.copy);
            const n = counts[p.key];
            return (
              <div key={p.key} className={'it' + (p.key === cur ? ' on' : '')}>
                <input type="checkbox" checked={!!sel[p.key]}
                  onChange={e => setSel(s => ({ ...s, [p.key]: e.target.checked }))}
                  aria-label={`批量选择 ${p.hint}`} />
                <button type="button" onClick={() => select(p.key)}>
                  {custom && <span className="dot" title="已自定义样式/文案"></span>}
                  {p.hint}
                  <em>{p.label}</em>
                </button>
                {n != null && n > 0 && <span className="cnt" title={`${n} 张照片`}>{n}</span>}
              </div>
            );
          })}
          <button type="button" id="batchBtn" disabled={busy} onClick={batchApply}>
            批量应用颜色
          </button>
        </aside>
        <section id="edit">
          <div className="mtabs" role="tablist" aria-label="配置模块">
            <button type="button" role="tab" aria-selected={tab === 'text'}
              className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>文字配置</button>
            <button type="button" role="tab" aria-selected={tab === 'photos'}
              className={tab === 'photos' ? 'on' : ''} disabled={!!cfKey}
              title={cfKey ? '封面/尾页无照片管理' : ''}
              onClick={() => setTab('photos')}>图片管理</button>
          </div>
          {tab === 'photos' ? (
            <div className="photos-panel">
              <PhotoPanel pages={pages} cur={cur} photos={photos} counts={counts} crops={crops}
                onUpload={handleUpload} onDeletePhoto={handleDeletePhoto}
                onCrop={f => setCropTarget({ file: f, crop: crops[f] || null })}
                onAddPage={handleAddPage} onDeletePage={handleDeletePage}
                onRenamePage={handleRenamePage} />
            </div>
          ) : cfKey ? (
            <div className="panel">
              <h3>文字内容 · {cfKey === 'cover' ? '封面' : '尾页'}</h3>
              <p className="sub">仅编辑文案，样式与颜色保持相册默认<em>留空该位置显示空白</em></p>
              <div className="cgrid cgrid-copy">
                {cfFieldsOf(cfKey).map(([k, cn, en]) => (
                  <label key={k} className="tfield">
                    <span className="lab">{cn} {en}</span>
                    <textarea rows={Array.isArray(cfDefaultOf(cfKey)[k]) ? 4 : 1}
                      placeholder={cfPlaceholderOf(cfKey, k)}
                      value={(cfDraft && cfDraft.copy[k]) || ''}
                      onChange={e => setCfCopy(k, e.target.value)}
                      onBlur={() => blurCfCopy(k)} />
                  </label>
                ))}
              </div>
            </div>
          ) : (
          <>
          <div className="panel">
            <h3>页面颜色 · PAGE COLORS</h3>
            <p className="sub">背景、线条与邮戳<em>留空表示默认 · × 恢复默认</em></p>
            <div className="cgrid">
              {[...BG_LINE_FIELDS, ...STAMP_FIELDS].map(colorRow)}
            </div>
            <div className="hline"></div>
            <p className="sub">文字元素颜色<em>独立控制每个文字元素</em></p>
            <div className="cgrid">
              {TEXT_COLOR_FIELDS.map(colorRow)}
            </div>
          </div>
          <div className="panel">
            <h3>文字内容 · COPY</h3>
            <p className="sub">编辑各元素文案<em>留空该位置显示空白</em></p>
            <div className="cgrid cgrid-copy">
              {COPY_FIELDS.map(([k, lab]) => (
                <label key={k} className="tfield">
                  <span className="lab">{lab}</span>
                  <textarea rows={k === 'quote' ? 2 : 1}
                    placeholder={stripHtml((page && chapterOf(page)[k]) || '')}
                    value={(draft && draft.copy[k]) || ''}
                    onChange={e => setCopy(k, e.target.value)}
                    onBlur={() => blurCopy(k)} />
                </label>
              ))}
            </div>
            <div className="tl">
              <span className="lab">时间线 TIMELINE</span>
              {(draft ? draft.timeline : []).map((row, i) => (
                <div key={i} className="tlrow">
                  <input type="text" className="t" placeholder="时间 如 07:20"
                    value={row[0]} onChange={e => setTimeline(i, 0, e.target.value)}
                    onBlur={() => blurTimeline(i)} />
                  <input type="text" className="s" placeholder="描述"
                    value={row[1]} onChange={e => setTimeline(i, 1, e.target.value)}
                    onBlur={() => blurTimeline(i)} />
                  <button type="button" className="x" onClick={() => delTimeline(i)} aria-label="删除此行">×</button>
                </div>
              ))}
              <button type="button" className="add" onClick={addTimeline}>＋ 添加时间线</button>
            </div>
          </div>
          </>
          )}
          {tab === 'text' && (
          <div className="acts">
            <button type="button" className="go" disabled={(!page && !cfKey) || busy} onClick={cfKey ? saveCf : save}>保存配置</button>
            <button type="button" disabled={(!page && !cfKey) || busy || (cfKey ? !cfSaved : !saved)} onClick={undo}>撤销更改</button>
            <button type="button" disabled={(!page && !cfKey) || busy} onClick={askReset}>恢复默认</button>
            <span className="hint">{cfKey
              ? '仅保存文字内容；留空该位置显示空白，恢复默认请点「恢复默认」'
              : '颜色留空表示默认；文字留空该位置显示空白，恢复默认请点「恢复默认」'}</span>
          </div>
          )}
        </section>
        <aside id="preview" className="pv" onClick={() => setFull(true)}>
          <div className="pv-head">
            <h3>实时预览</h3>
            <button type="button" className="full-btn"
              onClick={e => { e.stopPropagation(); setFull(true); }}>⛶ 完整视图</button>
          </div>
          <StampDefs />
          {previewInner(true)}
        </aside>
      </main>
      {full && (
      <div id="preview-full" role="dialog" aria-modal="true" aria-label="完整预览"
        onClick={e => { if (e.target === e.currentTarget) setFull(false); }}>
        <div className="full-bar">
          <span className="full-title">{cfKey === 'cover' ? '封面 · 完整预览'
            : cfKey === 'fin' ? '尾页 · 完整预览'
            : (page ? page.hint + ' · 完整预览' : '完整预览')}</span>
          <button type="button" className="full-x" onClick={() => setFull(false)}
            aria-label="关闭完整预览">× 关闭</button>
        </div>
        <div className="full-wrap pv">
          <StampDefs />
          {previewInner()}
        </div>
      </div>
      )}
      {cropTarget && (
        <CropTool key={cropTarget.file} page={cur} file={cropTarget.file} crop={cropTarget.crop}
          onSave={c => handleSaveCrop(cropTarget.file, c)} onClose={() => setCropTarget(null)} />
      )}
      {toast && <div id="status" className={'show ' + toast.kind}>{toast.msg}</div>}
      {modal && <Modal opts={modal} onClose={closeModal} />}
    </>
  );
}

/* color inputs need a valid hex value — expand #RGB to #RRGGBB, else fall back */
function normalizeColor(v) {
  const s = String(v || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : '#000000';
}

/* ─── photo crop tool ───────────────────────────────────────────────
   A draggable selection box on the full image: drag inside the box to
   move the focus, drag a corner handle to zoom the window (the box keeps
   the stage aspect ratio = the album's photo column), reset returns to
   plain cover-centre. The live preview pane renders the exact cropStyle
   the album applies, so what the box frames is what the page shows.   */
const STAGE_AR = 3 / 4; /* editor window aspect ≈ the album photo column */

function CropTool({ page, file, crop, onSave, onClose }) {
  const [draft, setDraft] = useState(crop && !isDefaultCrop(crop) ? { ...crop } : defaultCrop());
  const [img, setImg] = useState(null);      /* {w,h} natural size */
  const [sizes, setSizes] = useState(null);  /* {sw,sh,pw,ph} measured panes */
  const stageRef = useRef(null);
  const prevRef = useRef(null);
  const dragRef = useRef(null);              /* active drag session */
  const src = photoUrl(page, file);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* measure the stage + preview panes (responsive) */
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const m = {};
      for (const en of entries) {
        const r = en.contentRect;
        if (en.target === stageRef.current) { m.sw = r.width; m.sh = r.height; }
        else { m.pw = r.width; m.ph = r.height; }
      }
      setSizes(s => ({ ...(s || {}), ...m }));
    });
    if (stageRef.current) ro.observe(stageRef.current);
    if (prevRef.current) ro.observe(prevRef.current);
    return () => ro.disconnect();
  }, []);

  /* stage metrics: contained image rect (the <img> keeps its natural ratio
     via max-width/max-height) + the current selection box in stage pixels */
  const geo = useMemo(() => {
    if (!img || !sizes || !stageRef.current) return null;
    const imgEl = stageRef.current.querySelector('img');
    if (!imgEl) return null;
    const dw = imgEl.offsetWidth, dh = imgEl.offsetHeight;
    if (!dw || !dh) return null;
    const ox = (sizes.sw - dw) / 2, oy = (sizes.sh - dh) / 2;
    const win0 = Math.min(1, STAGE_AR / (img.w / img.h)); /* cover window (norm) */
    const r = windowRectOf(draft, img.w, img.h, STAGE_AR);
    return {
      dw, dh, ox, oy, win0,
      box: { x: ox + r.x * dw, y: oy + r.y * dh, w: r.w * dw, h: r.h * dh },
    };
  }, [img, draft, sizes]);

  /* pointer event → normalized image coordinates inside the stage */
  const pointOf = useCallback(ev => {
    const g = geo, r = stageRef.current && stageRef.current.getBoundingClientRect();
    if (!g || !r) return null;
    return {
      x: Math.min(1, Math.max(0, (ev.clientX - r.left - g.ox) / g.dw)),
      y: Math.min(1, Math.max(0, (ev.clientY - r.top - g.oy) / g.dh)),
    };
  }, [geo]);

  /* drag sessions: 'move' pans the focus, corner names resize around the
     opposite corner while keeping the stage aspect ratio */
  const startDrag = (mode, e) => {
    e.preventDefault();
    const g = geo, p = pointOf(e);
    if (!g || !p) return;
    dragRef.current = { mode, start: p, crop: { ...draft }, box: { ...g.box }, g };
    const move = ev => {
      const d = dragRef.current, q = pointOf(ev);
      if (!d || !q) return;
      if (d.mode === 'move') {
        const win = windowRectOf(d.crop, img.w, img.h, STAGE_AR);
        const fx = Math.min(1 - win.w / 2, Math.max(win.w / 2, d.crop.fx + q.x - d.start.x));
        const fy = Math.min(1 - win.h / 2, Math.max(win.h / 2, d.crop.fy + q.y - d.start.y));
        setDraft({ ...d.crop, fx, fy });
      } else {
        const dir = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] }[d.mode];
        const ax = d.box.x + (dir[0] > 0 ? 0 : d.box.w);
        const ay = d.box.y + (dir[1] > 0 ? 0 : d.box.h);
        const aspect = d.box.w / d.box.h;
        let w = Math.max(
          Math.abs(d.g.ox + q.x * d.g.dw - ax),
          Math.abs(d.g.oy + q.y * d.g.dh - ay) * aspect);
        const minW = (d.g.win0 * d.g.dw) / CROP_MAX_ZOOM;
        const maxW = Math.min(d.g.win0 * d.g.dw,
          dir[0] > 0 ? d.g.ox + d.g.dw - ax : ax - d.g.ox,
          dir[1] > 0 ? d.g.oy + d.g.dh - ay : ay - d.g.oy);
        w = Math.min(maxW, Math.max(minW, w));
        const h = w / aspect;
        const fx = Math.min(1, Math.max(0, (ax - d.g.ox - (dir[0] > 0 ? 0 : w) + w / 2) / d.g.dw));
        const fy = Math.min(1, Math.max(0, (ay - d.g.oy - (dir[1] > 0 ? 0 : h) + h / 2) / d.g.dh));
        setDraft({ fx, fy, zoom: Math.round((d.g.win0 * d.g.dw / w) * 100) / 100 });
      }
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const previewStyle = img && sizes && sizes.pw
    ? { backgroundImage: `url('${src}')`, ...cropStyle(draft, sizes.pw, sizes.ph, img.w, img.h) }
    : { backgroundImage: `url('${src}')` };

  return (
    <div id="cropDlg" role="dialog" aria-modal="true" aria-label="裁剪照片"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="crop-panel">
        <div className="crop-head">
          <h3>裁剪照片</h3>
          <span className="crop-file">{file}</span>
          <button type="button" className="full-x" onClick={onClose}>× 关闭</button>
        </div>
        <div className="crop-body">
          <div className="crop-stage" ref={stageRef}>
            <img src={src} alt="" draggable={false}
              onLoad={e => setImg({ w: e.target.naturalWidth, h: e.target.naturalHeight })} />
            {geo && (
              <div className="crop-box"
                style={{ left: geo.box.x, top: geo.box.y, width: geo.box.w, height: geo.box.h }}
                onPointerDown={e => startDrag('move', e)}>
                <i className="ln ln-h"></i><i className="ln ln-v"></i>
                <span className="hd nw" onPointerDown={e => { e.stopPropagation(); startDrag('nw', e); }}></span>
                <span className="hd ne" onPointerDown={e => { e.stopPropagation(); startDrag('ne', e); }}></span>
                <span className="hd sw" onPointerDown={e => { e.stopPropagation(); startDrag('sw', e); }}></span>
                <span className="hd se" onPointerDown={e => { e.stopPropagation(); startDrag('se', e); }}></span>
              </div>
            )}
          </div>
          <div className="crop-side">
            <div className="crop-preview" ref={prevRef} style={previewStyle}
              aria-label="实时裁剪预览"></div>
            <div className="crop-info">
              <span className="zoom">缩放 ×{draft.zoom.toFixed(2)}</span>
              <span className="hint">拖动框内移动 · 拖动四角缩放 · 重置恢复原始显示</span>
            </div>
            <div className="crop-acts">
              <button type="button" onClick={() => setDraft(defaultCrop())}>重置</button>
              <button type="button" className="cancel" onClick={onClose}>取消</button>
              <button type="button" className="go"
                onClick={() => onSave(isDefaultCrop(draft) ? null : draft)}>保存裁剪</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
