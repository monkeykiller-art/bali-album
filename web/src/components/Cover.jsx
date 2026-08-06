/* cover page — meta, hero title, index card rows, vertical bar nav, ENTER + gear.
   Hover/focus on a vbar sets the cover's data-tint so the divider/ENTER follow it.
   Edge auto-scroll: when the vbar list overflows, hovering the top/bottom edge
   smoothly scrolls it (scrollbar hidden) — mirrors the vanilla roll feel.
   vbar thumbnails: first photo of each chapter from photos2 (via firsts), so
   uploads/deletes in the manager are reflected automatically. */
import { useCallback, useRef } from 'react';
import { photoUrl } from '../api';
import { COVER_DEFAULT } from '../coverfin';

/* tint: the hovered chapter's configured bg (style.bg) drives the cover's
   --tint via inline style (beats the static key-based rules); pages without a
   custom bg fall back to the .cover[data-tint=…] mapping in styles.css */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const tintOf = p => p.key || '';

const EDGE = 80;        /* px from top/bottom edge that triggers auto-scroll */
const STEP = 3;         /* px per frame — slow, smooth glide */

/* copy overrides from coverfin.json: every text element falls back to the
   built-in default per field (arrays fall back per item), so partial
   overrides never leave holes in the layout */
export default function Cover({ chapters, goto, active, firsts, copy }) {
  const c = { ...COVER_DEFAULT, ...(copy || {}) };
  const meta = i => (c.meta && c.meta[i]) || COVER_DEFAULT.meta[i] || '';
  const coverRef = useRef(null);
  const spaceRef = useRef(null);
  const dirRef = useRef(0);      /* -1 scroll up, +1 scroll down, 0 idle */
  const rafRef = useRef(null);
  const setTint = (key, bg) => {
    const el = coverRef.current;
    if (!el) return;
    if (key) {
      el.dataset.tint = key;
      if (bg && HEX.test(bg)) el.style.setProperty('--tint', bg);
      else el.style.removeProperty('--tint');
    } else {
      delete el.dataset.tint;
      el.style.removeProperty('--tint');
    }
  };
  const onOver = e => {
    const b = e.target.closest('.vbar');
    if (b && b.dataset.tint) {
      const p = chapters.find(c => c.key === b.dataset.tint);
      setTint(b.dataset.tint, p && p.style && p.style.bg);
    }
  };
  const onOut = e => {
    const b = e.target.closest('.vbar');
    if (b && !b.contains(e.relatedTarget)) setTint(null);
  };
  const onFocusIn = e => {
    const b = e.target.closest('.vbar');
    if (b && b.dataset.tint) {
      const p = chapters.find(c => c.key === b.dataset.tint);
      setTint(b.dataset.tint, p && p.style && p.style.bg);
    }
  };
  const onFocusOut = e => {
    if (e.target.classList && e.target.classList.contains('vbar')) setTint(null);
  };

  /* edge auto-scroll: one rAF loop reads the current direction and glides */
  const stopScroll = useCallback(() => {
    dirRef.current = 0;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const tick = useCallback(() => {
    const el = spaceRef.current;
    if (!el) { rafRef.current = null; return; }
    const d = dirRef.current;
    if (!d) { rafRef.current = null; return; }
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) { rafRef.current = null; return; }
    const next = el.scrollTop + d * STEP;
    if ((d > 0 && next >= max) || (d < 0 && next <= 0)) {
      el.scrollTop = d > 0 ? max : 0; /* land exactly on the edge, then stop */
      stopScroll();
      return;
    }
    el.scrollTop = next;
    rafRef.current = requestAnimationFrame(tick);
  }, [stopScroll]);

  const onMove = e => {
    const el = spaceRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let d = 0;
    if (e.clientY > r.bottom - EDGE) d = 1;
    else if (e.clientY < r.top + EDGE) d = -1;
    if (d === dirRef.current) return;
    dirRef.current = d;
    if (!d) { stopScroll(); return; }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  };

  const onLeave = () => stopScroll();

  return (
    <section className={'page cover' + (active ? ' active' : '')} style={{ '--accent': '#e56c2f' }} ref={coverRef}>
      <div className="cover-inner">
        <div className="cover-left">
          <div className="cover-meta">
            <span>{meta(0)}</span>
            <span>{meta(1)}</span>
            <span>{meta(2)}</span>
            <span>{meta(3)}</span>
          </div>
          <h1><span className="bali">{c.bali}</span><span className="num">{c.num}</span></h1>
          <div className="cover-cn">{c.cn}</div>
          <div className="cover-sub">{c.sub}</div>
          <div className="cover-divider" aria-hidden="true"></div>
          <div className="index-card" id="indexCard">
            {chapters.map((p, i) => (
              <div key={p.key} className="row" data-goto={String(i + 1)} onClick={() => goto(i + 1)}>
                <span className="n">{p.label}</span>
                <span className="d">{p.date || '--.--'}</span>
                <span className="p">{p.hint}</span>
                <span className="r">{p.region || ''}</span>
              </div>
            ))}
          </div>
          <button className="enter" type="button" disabled aria-disabled="true">{c.enter}</button>
          <div className="cover-dev">{c.dev}</div>
        </div>
        <div className="cover-space" id="coverSpace" aria-label="章节快速导航"
          ref={spaceRef}
          onPointerOver={onOver} onPointerOut={onOut} onFocusIn={onFocusIn} onFocusOut={onFocusOut}
          onPointerMove={onMove} onPointerLeave={onLeave}>
          {chapters.map((p, i) => {
            const shot = firsts && firsts[p.key];
            const bg = shot
              ? `url("${photoUrl(p.key, shot)}")`
              : (p.thumb ? `url("${p.thumb}")` : null);
            return (
              <button key={p.key} type="button" className="vbar"
                aria-label={`进入章节 ${p.label} ${p.hint}`}
                data-tint={tintOf(p)}
                style={bg ? { '--vb-img': bg } : null}
                onClick={() => goto(i + 1)}>
                <span className="vnum">{p.label}</span>
                <span className="vtime">EXP {p.date || '--.--'} · {p.region || '--'}</span>
                <span className="vname">{p.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      <a className="cover-admin" href="admin.html" aria-label="打开照片管理配置页面" title="照片管理">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </a>
    </section>
  );
}
