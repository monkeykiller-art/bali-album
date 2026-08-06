/* page tabs — real chapter title (e.g. BROMO) + photo-count badge, click switches the active page */
export default function Tabs({ pages, cur, counts, onSelect }) {
  return (
    <nav id="tabs" aria-label="选择页面">
      {pages.map(p => (
        <button key={p.key} type="button" className={p.key === cur ? 'on' : ''} onClick={() => onSelect(p.key)}>
          {p.label} <span className="n">{counts[p.key] || 0}</span>
        </button>
      ))}
    </nav>
  );
}
