/* BALI 2026 · unified manager entry (built as /bali-album/text.html) —
   text & style config + photo management in one three-column manager */
import React from 'react';
import { createRoot } from 'react-dom/client';
import TextConfig from './components/admin/TextConfig';
import './styles.css'; /* real chapter-card styles so the live preview is pixel-faithful */
import './admin.css';  /* photo panel (upload / grid / toolbar) styles */
import './text.css';   /* config-page layout, loaded last so it wins on shared rules */

createRoot(document.getElementById('root3')).render(<TextConfig />);
