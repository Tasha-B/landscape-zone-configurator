import type { Lang, Translations } from "../../lib/i18n/translations";

// Static artwork of the demo office (viewBox 0 0 800 600), drawn around the
// zones that come from the FloorPlan. Walls and furniture are not data;
// they become data only if the editor needs them.

// The zone the "tap a zone →" annotation points at, and the one whose
// marker plays the one-shot hint. Must be a real zone id of the plan.
export const HINT_ZONE_ID = "reception";

// Walls, doors, furniture and trees. Drawn after the zones, so walls sit on
// top of the marker strokes.
export function PlanBackground() {
  return (
    <>
      <defs>
        <g id="sketch-tree">
          <line x1={-9} y1={6} x2={9} y2={7} stroke="#9DB07B" strokeWidth={10} strokeLinecap="round" opacity={0.35} />
          <path
            d="M -12 2 C -15 -9 -5 -16 4 -13 C 14 -10 15 2 8 9 C 1 15 -10 12 -12 2 C -13 -5 -6 -10 1 -8"
            fill="none"
            stroke="#2A2620"
            strokeWidth={1.2}
            opacity={0.7}
          />
        </g>
      </defs>

      {/* Static walls, door, corridor divider — architectural outline, non-interactive. */}
      <g aria-hidden="true" style={{ pointerEvents: "none" }}>
        <path
          d="M 82 92 C 240 88 400 93 558 89 C 559 160 560 230 560 301 C 700 302 704 466 560 468 C 400 471 240 467 82 470 C 82 344 81 218 82 92 Z"
          fill="none"
          stroke="#2A2620"
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <line x1={120} y1={90} x2={160} y2={90} stroke="var(--color-paper)" strokeWidth={12} />
        <path
          d="M 121 90 L 122 128 M 159 90 C 152 108 138 122 122 128"
          fill="none"
          stroke="#2A2620"
          strokeWidth={1.3}
          opacity={0.7}
        />
        <path
          d="M 309 91 C 311 111 309 131 310 150 M 310 186 C 309 204 311 222 310 240 M 82 240 C 95 241 108 240 120 240 M 158 240 C 238 238 318 241 398 239 M 436 240 C 477 241 518 239 558 240 M 82 350 C 95 349 108 351 120 350 M 158 350 C 212 348 266 351 318 350 M 320 350 C 319 390 321 430 320 468"
          fill="none"
          stroke="#2A2620"
          strokeWidth={1.8}
          opacity={0.8}
        />
        <path
          d="M 310 150 L 344 151 C 342 166 330 180 311 185 M 122 240 L 121 274 C 136 272 150 260 157 241 M 436 240 L 437 274 C 422 272 408 260 401 241 M 122 350 L 121 384 C 136 382 150 370 157 351"
          fill="none"
          stroke="#2A2620"
          strokeWidth={1.1}
          opacity={0.5}
        />
        <path
          d="M 140 132 L 140 440"
          fill="none"
          stroke="#2A2620"
          strokeWidth={1.1}
          strokeDasharray="6 6"
          opacity={0.4}
        />
        <path d="M 136 432 L 140 440 L 144 432" fill="none" stroke="#2A2620" strokeWidth={1.1} opacity={0.4} />
      </g>

      {/* Furniture icons — reception sofa, meeting table + chairs, break-room rug, corridor bench. */}
      <g aria-hidden="true" fill="none" stroke="#2A2620" strokeWidth={1.3} opacity={0.75} style={{ pointerEvents: "none" }}>
        <path d="M 168 214 Q 228 178 288 214" />
        <path d="M 168 222 Q 228 186 288 222" />
        <circle cx={228} cy={206} r={5} />
        <rect x={375} y={158} width={120} height={40} rx={20} transform="rotate(-1 435 178)" />
        <circle cx={400} cy={212} r={6} />
        <circle cx={435} cy={214} r={6} />
        <circle cx={470} cy={212} r={6} />
        <circle cx={352} cy={178} r={6} />
        <circle cx={518} cy={178} r={6} />
        <rect x={380} y={262} width={56} height={26} transform="rotate(-1.2 408 275)" />
        <rect x={444} y={262} width={56} height={26} transform="rotate(1 472 275)" />
        <rect x={380} y={304} width={56} height={26} transform="rotate(0.8 408 317)" />
        <rect x={444} y={304} width={56} height={26} transform="rotate(-1 472 317)" />
        <rect x={90} y={446} width={140} height={16} transform="rotate(-0.5 160 454)" />
        <circle cx={284} cy={412} r={16} />
        <circle cx={284} cy={388} r={5} />
        <circle cx={262} cy={432} r={5} />
        <circle cx={306} cy={432} r={5} />
      </g>

      {/* Trees — only inside the building outline: open-floor and
          the large one anchoring Signature corner. No standalone
          tree markers floating outside the plan. */}
      <g aria-hidden="true" style={{ pointerEvents: "none" }}>
        <use href="#sketch-tree" transform="translate(530,278) scale(0.8)" />
        <use href="#sketch-tree" transform="translate(530,314) scale(0.8)" />
        <use href="#sketch-tree" transform="translate(588,385) scale(2.6)" opacity={0.5} />
      </g>
    </>
  );
}

interface PlanAnnotationsProps {
  lang: Lang;
  t: Translations;
}

// Handwritten notes around the plan: entry, tap hint, compass, sheet title.
// Drawn last, on top of everything.
export function PlanAnnotations({ lang, t }: PlanAnnotationsProps) {
  return (
    <g aria-hidden="true" className="font-marker" style={{ pointerEvents: "none", userSelect: "none" }}>
      <text x={180} y={66} textAnchor="middle" fontSize={17} fill="#2A2620">
        {t.map.entry}
      </text>
      <path d="M 172 72 C 158 84 150 96 146 110" fill="none" stroke="#2A2620" strokeWidth={1.2} opacity={0.6} />
      <path d="M 140 102 L 146 111 L 152 103" fill="none" stroke="#2A2620" strokeWidth={1.2} opacity={0.6} />

      {/* Click-affordance hint, pointing at Reception — same
          handwritten-annotation-with-arrow treatment as the hero
          illustration's "one deliberate specimen" note. Thin
          underline (not the thick highlighter stroke used
          elsewhere) so the hint reads more noticeably as "read
          me" without competing with the marker-highlight strokes. */}
      <g transform="rotate(-2 390 52)">
        <text
          x={390}
          y={52}
          textAnchor="middle"
          fontSize={18}
          fill="#796034"
        >
          {t.map.tapHint}
        </text>
        {/* Measured text width differs a lot by language (EN
            ~82px, RU ~110px) — a fixed underline would either
            overshoot EN or clip RU, so it's sized per language
            rather than eyeballed to one of them. */}
        <line
          x1={390 - (lang === "ru" ? 59 : 45)}
          y1={58}
          x2={390 + (lang === "ru" ? 59 : 45)}
          y2={58}
          stroke="#796034"
          strokeWidth={1}
          opacity={0.6}
        />
      </g>
      <path d="M 350 66 C 300 73 240 92 200 113" fill="none" stroke="#796034" strokeWidth={1.2} opacity={0.5} />
      <path d="M 210 105 L 200 113 L 211 119" fill="none" stroke="#796034" strokeWidth={1.2} opacity={0.5} />

      <line x1={742} y1={66} x2={742} y2={40} stroke="#2A2620" strokeWidth={1.4} opacity={0.7} />
      <path d="M 736 46 L 742 37 L 748 46" fill="none" stroke="#2A2620" strokeWidth={1.4} opacity={0.7} />
      <text x={742} y={30} textAnchor="middle" fontSize={17} fill="#2A2620">
        N
      </text>

      <line x1={58} y1={549} x2={380} y2={547} stroke="#C9A25C" strokeWidth={10} strokeLinecap="round" opacity={0.3} />
      <text x={60} y={542} fontSize={24} fill="#2A2620">
        {t.map.sheetTitle}
      </text>
      <text x={60} y={568} fontSize={15} fill="rgba(42,38,32,0.6)">
        {t.map.note}
      </text>
    </g>
  );
}
