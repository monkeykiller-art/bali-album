/* upload row — file picker (multi), upload button with progress hint, add-page button */
import { useRef, useState } from 'react';

const readBase64 = f => new Promise(ok => {
  const rd = new FileReader();
  rd.onload = () => ok(String(rd.result).split(',')[1] || '');
  rd.readAsDataURL(f);
});

export default function UploadBar({ onUpload, onAddPage }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  const doUpload = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const items = [];
      for (let i = 0; i < files.length; i++) {
        items.push({ name: files[i].name, data: await readBase64(files[i]) });
        setHint(`上传中… ${i + 1}/${files.length}`);
      }
      await onUpload(items);
      if (inputRef.current) inputRef.current.value = '';
      setFiles([]);
      setHint('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="upload">
      <label className="file" htmlFor="fileInput">
        <b>选择照片</b>
        <input ref={inputRef} type="file" id="fileInput" multiple accept="image/*"
          onChange={e => {
            setFiles([...e.target.files]);
            setHint(e.target.files.length ? `已选择 ${e.target.files.length} 张` : '');
          }} />
      </label>
      <button className="go" id="uploadBtn" disabled={!files.length || busy} onClick={doUpload}>上传</button>
      <button className="go alt" id="addPageBtn" type="button" onClick={onAddPage}>＋ 新增页面</button>
      <span className="hint" id="uploadHint">{hint}</span>
    </section>
  );
}
