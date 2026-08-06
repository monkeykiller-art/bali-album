/* fin page — roll end, stats, back-to-cover (mirrors the vanilla finale markup).
   Text comes from copy overrides (coverfin.json) falling back to the built-in
   defaults; stats fall back per item, so partial overrides stay safe. */
import { FIN_DEFAULT } from '../coverfin';

export default function Fin({ goto, active, copy }) {
  const c = { ...FIN_DEFAULT, ...(copy || {}) };
  const stats = i => (c.stats && c.stats[i]) || FIN_DEFAULT.stats[i] || ['', ''];
  return (
    <section className={'page fin' + (active ? ' active' : '')} style={{ '--accent': '#e56c2f' }}>
      <div className="roll-end">{c.rollEnd}</div>
      <h2>{c.title}<em>.</em></h2>
      <div className="fin-cn">{c.cn}</div>
      <div className="fin-stats">
        <div><b>{stats(0)[0]}</b><span>{stats(0)[1]}</span></div>
        <div><b>{stats(1)[0]}</b><span>{stats(1)[1]}</span></div>
        <div><b>{stats(2)[0]}</b><span>{stats(2)[1]}</span></div>
        <div><b>{stats(3)[0]}</b><span>{stats(3)[1]}</span></div>
      </div>
      <p className="fin-line">{c.line}</p>
      <button onClick={() => goto(0)}>{c.back}</button>
      <div className="dev">{c.dev}</div>
    </section>
  );
}
