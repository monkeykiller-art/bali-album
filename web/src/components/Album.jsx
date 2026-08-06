/* album shell — fetches page metadata, then renders COVER + chapters + FIN.
   Navigation: topbar buttons, cover bars/rows, keyboard, touch swipe, wheel
   (900ms debounce) — all mirroring the vanilla roll engine. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchPages, fetchPhotos, fetchCoverFin } from '../api';
import TopBar from './TopBar';
import Cover from './Cover';
import Chapter from './Chapter';
import Fin from './Fin';
import Grain from './Grain';
import { StampDefs } from './Stamp';

export default function Album() {
  const [pages, setPages] = useState(null);   /* chapter metadata from /api/pages */
  const [cf, setCf] = useState(null);          /* cover/fin copy overrides from /api/coverfin */
  const [cur, setCur] = useState(0);
  const [photos, setPhotos] = useState({});   /* pageKey -> [file,...] cache */
  const [cropMaps, setCropMaps] = useState({}); /* pageKey -> {file: crop} cache */
  const [firsts, setFirsts] = useState({});   /* pageKey -> first photo (vbar thumbnails) */
  const wl = useRef(false);                   /* wheel debounce flag */

  const total = useMemo(() => (pages ? pages.length + 2 : 0), [pages]); /* cover + chapters + fin */

  useEffect(() => {
    fetchPages()
      .then(r => setPages((r && r.pages) || []))
      .catch(() => setPages([]));
    fetchCoverFin()
      .then(d => setCf(d || {}))
      .catch(() => setCf({}));
  }, []);

  /* cover vbar thumbnails: first photo of each chapter from photos2 (data-driven,
     so uploads/deletes show up on the next visit). Empty pages fall back to p.thumb. */
  useEffect(() => {
    if (!pages || !pages.length) return;
    let alive = true;
    Promise.all(pages.map(p => fetchPhotos(p.key).catch(() => null)))
      .then(lists => {
        if (!alive) return;
        const m = {};
        lists.forEach((l, i) => {
          if (l && l.photos && l.photos.length) m[pages[i].key] = l.photos[0];
        });
        setFirsts(m);
      });
    return () => { alive = false; };
  }, [pages]);

  const goto = useCallback(i => {
    if (!total) return;
    setCur(((i % total) + total) % total);
  }, [total]);

  /* keyboard: arrows + Home/End */
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goto(cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goto(cur - 1);
      else if (e.key === 'Home') goto(0);
      else if (e.key === 'End') goto(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, cur, total]);

  /* touch swipe (threshold 60px, mirrors vanilla) */
  useEffect(() => {
    let tx = null;
    const onStart = e => { tx = e.touches[0].clientX; };
    const onEnd = e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 60) goto(cur + (dx < 0 ? 1 : -1));
      tx = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [goto, cur]);

  /* wheel paging (debounced 900ms, |deltaY| >= 28) */
  useEffect(() => {
    const onWheel = e => {
      if (wl.current || Math.abs(e.deltaY) < 28) return;
      wl.current = true;
      goto(cur + (e.deltaY > 0 ? 1 : -1));
      setTimeout(() => { wl.current = false; }, 900);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [goto, cur]);

  /* lazy photo lists + crop maps, cached per page key */
  const loadPhotos = useCallback(key => {
    if (photos[key]) return;
    fetchPhotos(key)
      .then(r => {
        setPhotos(m => ({ ...m, [key]: (r && r.photos) || [] }));
        setCropMaps(m => ({ ...m, [key]: (r && r.crops) || {} }));
      })
      .catch(() => setPhotos(m => ({ ...m, [key]: [] })));
  }, [photos]);

  return (
    <>
      <Grain />
      <TopBar cur={cur} total={total} goto={goto} />
      <StampDefs />
      <main id="stage">
        {pages && (
          <>
            <Cover chapters={pages} goto={goto} active={cur === 0} firsts={firsts} copy={cf && cf.cover} />
            {pages.map((p, i) => (
              <Chapter key={p.key} p={p} active={cur === i + 1}
                photos={photos[p.key]} crops={cropMaps[p.key]} onLoad={loadPhotos} />
            ))}
            <Fin goto={goto} active={cur === total - 1} copy={cf && cf.fin} />
          </>
        )}
      </main>
    </>
  );
}
