/* photo management panel — upload, photo grid CRUD, add/rename/delete page.
   Part of the unified manager (see TextConfig.jsx): the page list, live
   preview and shared state (toast / modal / busy / pages) live in the parent
   container; this panel only wires the photo workflows, so both modules share
   one page list and one preview without duplicated state. */
import UploadBar from './UploadBar';
import PhotoGrid from './PhotoGrid';
import Toolbar from './Toolbar';

export default function PhotoPanel({ pages, cur, photos, counts, crops,
  onUpload, onDeletePhoto, onCrop, onAddPage, onDeletePage, onRenamePage }) {
  /* child components expect {key, label: display title, chapter: album no} */
  const view = pages.map(p => ({ key: p.key, label: p.hint, chapter: p.label }));
  const page = view.find(p => p.key === cur) || null;
  return (
    <>
      <UploadBar onUpload={onUpload} onAddPage={onAddPage} />
      <Toolbar page={page} count={counts[cur]} canDelete={!!page && pages.length > 1}
        onRenamePage={onRenamePage} onDeletePage={onDeletePage} />
      <PhotoGrid photos={photos} cur={cur} crops={crops} onCrop={onCrop} onDelete={onDeletePhoto} />
    </>
  );
}
