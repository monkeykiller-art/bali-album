/* cover-crop math shared by the album renderer and the crop editor.
   A crop is {fx, fy, zoom}: a normalized focus point (0-1) plus a zoom
   factor (1 = plain cover-centre, up to CROP_MAX_ZOOM). The visible window
   always keeps the container's aspect ratio, so nothing stretches at any
   screen size — the window shape follows the container, the content follows
   the user's focus point. */
export const CROP_MAX_ZOOM = 4;

export const defaultCrop = () => ({ fx: 0.5, fy: 0.5, zoom: 1 });
export const isDefaultCrop = c => !c || (c.fx === 0.5 && c.fy === 0.5 && c.zoom === 1);

/* background-size / background-position for a .bshot under a user crop.
   s0 is the cover scaling of the image (render size = image size × s0), so
   the size percentage must be kx = render width ÷ container width — the
   browser computes background-size % against the container, not the image.
   With zoom = 1 the math collapses exactly onto plain cover + centre. */
export function cropStyle(crop, cw, ch, iw, ih) {
  const { fx, fy, zoom } = crop || defaultCrop();
  const s0 = Math.max(cw / iw, ch / ih);
  const s = s0 * Math.max(1, zoom);
  const kx = (iw * s) / cw, ky = (ih * s) / ch;
  /* align the image point fx (fy) with the container centre; on the axis
     with no cropping the offset is meaningless, so keep it centred */
  const posX = kx > 1.0001 ? Math.min(1, Math.max(0, (fx * kx - 0.5) / (kx - 1))) : 0.5;
  const posY = ky > 1.0001 ? Math.min(1, Math.max(0, (fy * ky - 0.5) / (ky - 1))) : 0.5;
  return {
    backgroundSize: `${(kx * 100).toFixed(3)}% auto`,
    backgroundPosition: `${(posX * 100).toFixed(3)}% ${(posY * 100).toFixed(3)}%`,
  };
}

/* the visible window on the source image (normalized 0-1) for the editor
   overlay: arC is the editor stage's aspect ratio (the box on the stage and
   the live preview pane share it, so what the box covers is what the page
   shows). zoom=1 yields the plain cover window. */
export function windowRectOf(crop, iw, ih, arC) {
  const { fx, fy, zoom } = crop || defaultCrop();
  const arI = iw / ih;
  const w0 = Math.min(1, arC / arI);
  const h0 = Math.min(1, arI / arC);
  const w = w0 / Math.max(1, zoom);
  const h = h0 / Math.max(1, zoom);
  return { x: fx - w / 2, y: fy - h / 2, w, h };
}
