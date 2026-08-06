/* modal dialog — React port of the vanilla ask(); resolves with the input value
   (or true when input:false), or null when cancelled.
   opts: {title, msg, placeholder, okText, danger, input:false, validate(v)} */
import { useEffect, useRef, useState } from 'react';

export default function Modal({ opts, onClose }) {
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  const { title, msg, placeholder, okText, danger, input, validate } = opts;

  useEffect(() => {
    setValue('');
    setErr('');
    if (input !== false && inputRef.current) inputRef.current.focus();
  }, [opts, input]);

  const submit = () => {
    const v = input === false ? true : value.trim();
    if (input !== false) {
      if (!v) { if (inputRef.current) inputRef.current.focus(); return; }
      if (validate) {
        const e = validate(v);
        if (e) { setErr(e); return; }
      }
    }
    onClose(v);
  };
  const cancel = () => onClose(null);
  const onKey = e => {
    if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') cancel();
  };

  return (
    <div id="dlg" className="show" role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="box">
        <h3>{title}</h3>
        <p className={err ? 'err' : ''}>{err || msg}</p>
        {input !== false && (
          <input ref={inputRef} type="text" placeholder={placeholder || ''}
            value={value} onChange={e => setValue(e.target.value)} onKeyDown={onKey} />
        )}
        <div className="row">
          <button type="button" className="cancel" onClick={cancel}>取消</button>
          <button type="button" className={'ok' + (danger ? ' danger' : '')} onClick={submit}>{okText || '确定'}</button>
        </div>
      </div>
    </div>
  );
}
