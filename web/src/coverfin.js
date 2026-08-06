/* cover & fin page copy — single source of truth for the hard-coded texts.
   TextConfig edits these via coverfin.json overrides; the album components
   render (copy field || default) so an unconfigured album keeps this exact
   copy. Array fields (meta / stats) are edited line by line and fall back
   per item, so partial overrides stay safe. */

export const COVER_DEFAULT = {
  meta: [
    'BALI 2026 • TRAVEL JOURNAL',
    'ROLL 01 • COVER',
    'KODAK PORTRA 400 • 05 EXP',
    'EAST JAVA • BALI • 04.26 – 05.02',
  ],
  bali: 'BALI',
  num: '2026',
  cn: '巴厘 · 二〇二六',
  sub: 'a roll exposed across volcanoes, terraces & tides',
  enter: 'ENTER ROLL',
  dev: 'DEV 05.04.2026 • PORTRA PROCESS C-41 • BUILD 5',
};

export const FIN_DEFAULT = {
  rollEnd: 'ROLL 01 • ALL FRAMES EXPOSED',
  title: 'FIN',
  cn: '全 卷 显 影 完 成',
  stats: [
    ['05', 'EXPOSURES'],
    ['07', 'DAYS'],
    ['02', 'ISLANDS'],
    ['∞', 'MEMORIES'],
  ],
  line: '火山、蓝焰、悬崖、梯田与海岛——\n一卷轴 Portra 400，把七天装进了五次曝光里。',
  back: '↺ BACK TO COVER',
  dev: 'DEV 05.04.2026 • BALI 2026 • KODAK PORTRA 400',
};
