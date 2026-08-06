/* photo grid — thumbnail cards with index badge, filename, crop + delete */
import { photoUrl } from '../../api';

export default function PhotoGrid({ photos, cur, crops, onCrop, onDelete }) {
  return (
    <section id="grid" aria-label="照片列表">
      {!photos.length && (
        <div className="hint" style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center' }}>暂无照片 —— 选择文件后点击「上传」添加</div>
      )}
      {photos.map((f, i) => (
        <figure key={f} className="card">
          <div className="thumb" style={{ backgroundImage: `url('${photoUrl(cur, f)}')` }}>
            <span className="idx">{String(i + 1).padStart(2, '0')}</span>
          </div>
          <figcaption className="meta">
            <div className="name">{f}</div>
            <div className="acts">
              <button type="button" className={'crop' + (crops && crops[f] ? ' on' : '')}
                title={crops && crops[f] ? '已自定义裁剪' : '裁剪照片'}
                onClick={() => onCrop(f)}>裁剪</button>
              <button type="button" className="del" onClick={() => onDelete(f)}>删除</button>
            </div>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
