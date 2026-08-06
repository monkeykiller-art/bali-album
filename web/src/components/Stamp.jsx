/* postmark stamp — shared SVG defs (ring path + rough-ink filter) + the stamp itself.
   StampDefs renders once in the album root so every <textPath> can reference #sring. */
export function StampDefs() {
  return (
    <svg className="s-defs" aria-hidden="true">
      <defs>
        <path id="sring" d="M9,60 a51,51 0 1,1 102,0 a51,51 0 1,1 -102,0" />
        <filter id="s-rough">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" />
        </filter>
      </defs>
    </svg>
  );
}

/* double ring + circular text + centered year (mirrors the vanilla markup) */
export default function Stamp({ data }) {
  const s = data || { label: 'BALI · 2026 ARRIVED', ring: 'BALI · 2026 ARRIVED', region: 'BALI', year: '2026' };
  return (
    <div className="stamp" role="img" aria-label={s.label}>
      <svg viewBox="-8 -8 136 136" aria-hidden="true"><g filter="url(#s-rough)">
        <circle className="s-o" cx="60" cy="60" r="66" />
        <circle className="s-i" cx="60" cy="60" r="49" />
        <text className="s-ring"><textPath href="#sring" xlinkHref="#sring" startOffset="30">{s.ring}</textPath></text>
        <text className="s-region" x="60" y="46">{s.region}</text>
        <text className="s-year" x="60" y="78">{s.year}</text>
      </g></svg>
    </div>
  );
}
