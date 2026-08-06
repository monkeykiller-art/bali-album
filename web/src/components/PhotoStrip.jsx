/* chapter photo viewer — full-bleed shots + film-strip thumbnails.
   Thumbnail clicks swap the active shot and the 2-digit counter (was vanilla JS).
   crops: {file -> {fx,fy,zoom}} from /api/photos — a custom crop overrides
   the default cover-centre look without touching the photo files themselves. */
import { useEffect, useRef, useState } from 'react';
import { photoUrl } from '../api';
import { cropStyle } from '../crop';
import PhotoLightbox from './PhotoLightbox';

export default function PhotoStrip({ p, photos, data, crops, preview }) {
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState(false); /* full-res lightbox open */
  const [dims, setDims] = useState({});   /* file -> {w,h} natural size, probed once */
  const [box, setBox] = useState(null);   /* measured chapter-space size */
  const spaceRef = useRef(null);
  useEffect(() => { setIdx(0); setView(false); }, [p.key]); /* reset when switching chapters */
  /* simplified preview (text-config side pane): first shot only, and no
     thumb strip / counter — the fullscreen overlay renders the full viewer */
  const all = photos || [];
  const list = preview ? all.slice(0, 1) : all;
  /* clicking the photo area opens the untouched original — inert in the
     text-config preview pane and on empty chapters */
  const openable = !preview && list.length > 0;

  /* probe natural image sizes (the browser serves them from the same cache
     as the background images) so a crop can be applied pixel-faithfully */
  useEffect(() => {
    let alive = true;
    const m = {};
    let pending = list.length;
    if (!pending) return;
    list.forEach(f => {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        m[f] = { w: img.naturalWidth, h: img.naturalHeight };
        if (--pending === 0) setDims({ ...m });
      };
      img.onerror = () => { if (alive && --pending === 0) setDims({ ...m }); };
      img.src = photoUrl(p.key, f);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.key, list.join('|'), crops]);

  /* the crop window keeps the container's aspect ratio, so the render math
     needs the live size of .chapter-space (responsive across breakpoints) */
  useEffect(() => {
    const el = spaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bshotStyle = f => {
    const st = { backgroundImage: `url('${photoUrl(p.key, f)}')` };
    const c = crops && crops[f], d = dims[f];
    if (c && d && box && (c.zoom > 1 || c.fx !== 0.5 || c.fy !== 0.5)) {
      Object.assign(st, cropStyle(c, box.w, box.h, d.w, d.h));
    }
    return st;
  };

  return (
    <div className="chapter-space" ref={spaceRef}
      style={openable ? { cursor: 'zoom-in' } : undefined}
      onClick={openable ? () => setView(true) : undefined}>
      {list.length === 0
        ? <div className="bshot active"></div>
        : list.map((f, i) => (
          <div key={f} className={'bshot' + (i === idx ? ' active' : '')}
            style={bshotStyle(f)}></div>
        ))}
      <div className="bcaption">
        <div className="bchapter">{data.bchapter}</div>
        <div className="btagline" dangerouslySetInnerHTML={{ __html: data.btagline }} />
      </div>
      {!preview && <div className="bcount">{String(idx + 1).padStart(2, '0')}</div>}
      {!preview && <div className="bthumbs">
        {list.map((f, i) => (
          <button key={f} type="button" className={'bthumb' + (i === idx ? ' active' : '')}
            style={{ backgroundImage: `url('${photoUrl(p.key, f)}')` }}
            aria-label={`照片 ${i + 1}`}
            onClick={e => { e.stopPropagation(); setIdx(i); }} />
        ))}
      </div>}
      {view && openable && (
        <PhotoLightbox page={p.key} photos={list} idx={idx}
          onChange={setIdx} onClose={() => setView(false)} />
      )}
    </div>
  );
}
