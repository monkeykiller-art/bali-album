/* top bar: brand + page pager + prev/next buttons (mirrors the vanilla markup) */
export default function TopBar({ cur, total, goto }) {
  return (
    <header className="topbar">
      <div className="brand">BALI 2026 • TRAVEL JOURNAL</div>
      <div className="top-pager">
        <span className="dash"></span>
        <button className="tp-btn" onClick={() => goto(cur - 1)} aria-label="上一页">‹</button>
        <span className="tp-count"><b>{cur + 1}</b> / {total}</span>
        <button className="tp-btn" onClick={() => goto(cur + 1)} aria-label="下一页">›</button>
        <span className="dash"></span>
      </div>
      <div className="nav-btns">
        <button onClick={() => goto(cur - 1)}>‹ PREV</button>
        <button onClick={() => goto(cur + 1)}>NEXT ›</button>
      </div>
    </header>
  );
}
