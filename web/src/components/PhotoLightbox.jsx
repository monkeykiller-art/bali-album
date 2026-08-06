/* fullscreen viewer for the untouched full-resolution photo — opened by
   clicking the chapter photo area. The image is the same /photos2 file the
   strips render (no crop applied), paged with the on-screen arrows or the
   keyboard; clicking the image itself, × / Esc / backdrop click all close
   it (the arrows sit beside the image, so paging never collides). The root
   stops click propagation: the lightbox lives inside .chapter-space, whose
   own onClick would otherwise reopen it right after closing. Navigation
   events are swallowed in the capture phase so the album's global paging
   (arrow keys, swipe, wheel) stays inert while the lightbox is open. */
import { useCallback, useEffect } from 'react';
import { photoUrl } from '../api';

export default function PhotoLightbox({ page, photos, idx, onChange, onClose }) {
  const n = photos.length;
  const prev = useCallback(() => onChange((idx - 1 + n) % n), [idx, n, onChange]);
  const next = useCallback(() => onChange((idx + 1) % n), [idx, n, onChange]);

  useEffect(() => {
    const stop = e => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    };
    const onKey = e => {
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', stop, { capture: true });
    window.addEventListener('touchstart', stop, { capture: true, passive: true });
    window.addEventListener('touchend', stop, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', stop, true);
      window.removeEventListener('touchstart', stop, true);
      window.removeEventListener('touchend', stop, true);
    };
  }, [onClose, prev, next]);

  const f = photos[idx];
  return (
    <div id="plight" role="dialog" aria-modal="true" aria-label="原图查看"
      onClick={e => {
        e.stopPropagation(); /* keep .chapter-space from reopening it */
        if (e.target === e.currentTarget) onClose();
      }}>
      <div className="pl-bar">
        <span className="pl-name">{f}</span>
        <span className="pl-count">{String(idx + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        <button type="button" className="pl-x" onClick={onClose} aria-label="关闭原图查看">× 关闭</button>
      </div>
      <img key={f} className="pl-img" src={photoUrl(page, f)} alt="完整原图"
        onClick={onClose} />
      {n > 1 && (
        <>
          <button type="button" className="pl-nav prev" onClick={prev} aria-label="上一张">‹</button>
          <button type="button" className="pl-nav next" onClick={next} aria-label="下一张">›</button>
        </>
      )}
    </div>
  );
}
