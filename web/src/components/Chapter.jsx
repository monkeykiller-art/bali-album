/* chapter page — copy comes from data.js (keyed by p.key, fallback default),
   photos are fetched on demand from /api/photos (cached in the album root). */
import { useEffect } from 'react';
import { chapterOf } from '../data';
import Stamp from './Stamp';
import PhotoStrip from './PhotoStrip';

export default function Chapter({ p, active, photos, crops, onLoad, preview }) {
  const data = chapterOf(p);
  useEffect(() => {
    if (active && !photos) onLoad(p.key);
  }, [active, photos, onLoad, p.key]);
  const cls = 'page chapter alt ' + p.cls + (data.photo ? ' photo-page' : '') + (active ? ' active' : '');
  /* text-config overrides: map {line,bg} + one field per text element onto
     the --t-* palette. When a page has no custom style the variables stay
     unset and the per-chapter defaults in styles.css keep the original look. */
  const vars = {};
  if (p.style) {
    const s = p.style;
    if (s.bg) vars['--t-bg'] = s.bg;
    if (s.line) { vars['--t-line'] = s.line; vars['--t-rule'] = s.line; vars['--t-hair'] = s.line; }
    const TEXT_VARS = {
      titleColor: '--t-title-color', kickerColor: '--t-kicker-color', cnColor: '--t-cn-color',
      taglineColor: '--t-tagline-color', quoteColor: '--t-quote-color', quoteCnColor: '--t-quotecn-color',
      spotColor: '--t-spot-color', btagColor: '--t-btag-color', tlColor: '--t-tl-color',
    };
    for (const [k, v] of Object.entries(TEXT_VARS)) if (s[k]) vars[v] = s[k];
    if (s.stampColor) vars['--t-stamp-color'] = s.stampColor; /* postmark ink */
    /* legacy: a unified text colour still applies everywhere until re-saved */
    if (s.text) for (const v of Object.values(TEXT_VARS)) vars[v] = s.text;
  }
  return (
    <section className={cls} style={{ '--accent': '#e56c2f', ...vars }}>
      <div className="info">
        <div className="kicker" dangerouslySetInnerHTML={{ __html: data.kicker }} />
        <h2 className="title">{data.title}</h2>
        <div className="underline"></div>
        <div className="cn-sub">{data.cn}</div>
        <div className="tagline" dangerouslySetInnerHTML={{ __html: data.tagline }} />
        <blockquote className="quote">
          {data.quote}
          <div className="quote-cn">{data.quoteCn}</div>
        </blockquote>
        <div className="alt-row">
          <ul className="timeline">
            {data.timeline.map(([n, t, s]) => (
              <li key={n}><b>{n}</b><span className="t">{t}</span>{s}</li>
            ))}
          </ul>
          <Stamp data={data.stamp} />
        </div>
        <div className="spot" dangerouslySetInnerHTML={{ __html: data.spot }} />
      </div>
      {(data.photo || p.key === 'bromo') && <PhotoStrip p={p} photos={photos} crops={crops} data={data} preview={preview} />}
    </section>
  );
}
