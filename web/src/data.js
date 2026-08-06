/* BALI 2026 · chapter copy — hard-coded per chapter key (migrated verbatim from
   the vanilla sections in index.html). Unknown keys (e.g. freshly created pages)
   fall back to DEFAULT_CHAPTER so every page renders a full chapter card. */

export const CHAPTERS = {
  bromo: {
    photo: false, /* bromo keeps its original section classes (no photo-page) */
    kicker: 'CHAPTER 01 · <b>EAST JAVA</b> · INDONESIA',
    title: 'BROMO',
    cn: '布罗莫',
    tagline: 'jeep across the <em>sea of mist</em>',
    quote: 'The volcano was breathing — we arrived just in time to hear its first exhale of the day.',
    quoteCn: '火山在呼吸，我们刚好赶上它清晨的第一声吐息。',
    timeline: [
      ['01', '03:30', '泗水出发 · 夜路进山'],
      ['02', '04:59', '火山口 · 登顶 · 硫磺蒸汽'],
      ['03', '06:12', '观景台 · 云海日出'],
    ],
    stamp: { label: 'JAVA · 2026 ARRIVED', ring: 'JAVA · 2026 ARRIVED', region: 'JAVA', year: '2026' },
    spot: '<b>SPOT</b> • EAST JAVA 2026 • 01',
    bchapter: 'CHAPTER 01 · EAST JAVA · INDONESIA',
    btagline: 'first light on the <em>smoking cone</em>',
  },
  uluwatu: {
    photo: true,
    kicker: 'CHAPTER 02 · <b>BALI</b> · INDONESIA',
    title: 'ULUWATU',
    cn: '乌鲁瓦图',
    tagline: 'the cliff temple above the <em>roaring sea</em>',
    quote: 'The ocean rehearsed its thunder below the cliff, and we listened at the very edge.',
    quoteCn: '大海在悬崖下排练雷声，我们站在最边缘聆听。',
    timeline: [
      ['01', '16:20', '潘达瓦海滩'],
      ['02', '17:05', '乌鲁瓦图寺庙'],
    ],
    stamp: { label: 'BALI · 2026 ARRIVED', ring: 'BALI · 2026 ARRIVED', region: 'BALI', year: '2026' },
    spot: '<b>SPOT</b> • BALI 2026 • 02',
    bchapter: 'CHAPTER 02 · BALI · INDONESIA',
    btagline: 'the cliff temple above the <em>roaring sea</em>',
  },
  ijen: {
    photo: true,
    kicker: 'CHAPTER 03 · <b>IJEN</b> · INDONESIA',
    title: 'IJEN',
    cn: '伊真',
    tagline: 'blue fire smoldering under the <em>acid lake</em>',
    quote: 'Down in the crater, the mountain glowed an impossible blue against the dark.',
    quoteCn: '火山口深处，山体在黑暗中亮起不可思议的蓝。',
    timeline: [
      ['01', '01:30', '夜爬火山 · 头灯长龙'],
      ['02', '04:10', '蓝火与硫磺烟'],
      ['03', '06:25', '酸性湖 · 破晓'],
    ],
    stamp: { label: 'JAVA · 2026 ARRIVED', ring: 'JAVA · 2026 ARRIVED', region: 'JAVA', year: '2026' },
    spot: '<b>SPOT</b> • EAST JAVA 2026 • 03',
    bchapter: 'CHAPTER 03 · IJEN · INDONESIA',
    btagline: 'blue fire smoldering under the <em>acid lake</em>',
  },
  ubud: {
    photo: true,
    kicker: 'CHAPTER 04 · <b>UBUD</b> · INDONESIA',
    title: 'UBUD',
    cn: '乌布',
    tagline: 'rice terraces breathing in the <em>morning mist</em>',
    quote: 'Ubud did not show us its beauty — it let us walk inside it.',
    quoteCn: '乌布从不向我们展示它的美，而是让我们走进其中。',
    timeline: [
      ['01', '07:20', '耶布鲁'],
      ['02', '10:15', '泰格拉朗'],
      ['03', '12:30', '乌布皇宫'],
    ],
    stamp: { label: 'UBUD · 2026 ARRIVED', ring: 'UBUD · 2026 ARRIVED', region: 'UBUD', year: '2026' },
    spot: '<b>SPOT</b> • UBUD 2026 • 04',
    bchapter: 'CHAPTER 04 · UBUD · INDONESIA',
    btagline: 'rice terraces breathing in the <em>morning mist</em>',
  },
  'nusa-penida': {
    photo: true,
    kicker: 'CHAPTER 05 · <b>NUSA PENIDA</b> · INDONESIA',
    title: 'NUSA PENIDA',
    cn: '努萨佩尼达',
    tagline: 'the island that forgot to <em>be polite</em>',
    quote: 'The island was all edges — cliffs, wind, and a sea that refused to be calm.',
    quoteCn: '这座岛浑身是棱角——悬崖、风，以及一片不肯平静的海。',
    timeline: [
      ['01', '07:50', '阿图海滩'],
      ['02', '10:20', '钻石海滩'],
    ],
    stamp: { label: 'BALI · 2026 ARRIVED', ring: 'BALI · 2026 ARRIVED', region: 'BALI', year: '2026' },
    spot: '<b>SPOT</b> • NUSA PENIDA 2026 • 05',
    bchapter: 'CHAPTER 05 · NUSA PENIDA · INDONESIA',
    btagline: 'the island that forgot to <em>be polite</em>',
  },
};

/* generic template for pages created via the photo manager (was newSectionText) */
export function defaultChapter(p) {
  const nn = p.label || '--';
  const title = (p.hint || 'NEW PAGE').toUpperCase();
  return {
    photo: true,
    kicker: `CHAPTER ${nn} · <b>INDONESIA</b> · CONTACT SHEET ${nn}`,
    title,
    cn: '新章节',
    tagline: 'a fresh roll on <em>open water</em>',
    quote: 'New chapter — add photos to bring this page to life.',
    quoteCn: '新章节 · 上传照片后即可点亮此页。',
    timeline: [['01', '--:--', '新目的地']],
    stamp: { label: 'INDONESIA · 2026 ARRIVED', ring: 'INDONESIA · 2026 ARRIVED', region: 'IDN', year: '2026' },
    spot: `<b>SPOT</b> • INDONESIA 2026 • ${nn}`,
    bchapter: `CHAPTER ${nn} · ${title} · INDONESIA`,
    btagline: 'a new page <em>ready for photos</em>',
  };
}

export function chapterOf(p) {
  const base = CHAPTERS[p.key] || defaultChapter(p);
  /* renamed pages: display name comes from p.hint (album nav + chapter title),
     and every hard-coded copy field mentioning the old title follows along */
  const title = (p.hint || base.title).toUpperCase();
  const copy = p.copy || {};
  let data = base;
  if (title !== base.title) {
    const walk = v => {
      if (typeof v === 'string') return v.split(base.title).join(title);
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      return v;
    };
    data = walk(base);
  }
  /* text-config overrides: user-edited copy wins over the hard-coded card */
  if (Object.keys(copy).length) {
    data = {
      ...data,
      ...copy,
      timeline: copy.timeline
        ? copy.timeline.map(([t, s], i) => [String(i + 1).padStart(2, '0'), t, s])
        : data.timeline,
    };
  }
  return data;
}
