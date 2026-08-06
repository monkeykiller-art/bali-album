/* page toolbar — current page info + rename + dangerous "delete this page" action */
export default function Toolbar({ page, count, canDelete, onRenamePage, onDeletePage }) {
  return (
    <div id="pageToolbar">
      <span id="tbInfo">
        {page
          ? <>当前页：<b>{page.label}</b>（{page.chapter}）· 共 {count || 0} 张照片</>
          : '加载中…'}
      </span>
      <span className="acts">
        <button type="button" id="renamePageBtn" disabled={!page} onClick={onRenamePage}>重命名</button>
        <button type="button" id="delPageBtn" disabled={!canDelete} onClick={onDeletePage}>删除此页面</button>
      </span>
    </div>
  );
}
