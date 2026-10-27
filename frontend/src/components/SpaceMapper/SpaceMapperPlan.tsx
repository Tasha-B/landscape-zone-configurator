
import type { CSSProperties, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { spaceZones, zoneContent } from "./zoneData";
import type { Lang, Translations } from "../../lib/i18n/translations";

const MARKER_DRAW_DURATION = 0.3;
const MARKER_STAGGER = 0.04;
const MARKER_FADE_DURATION = 0.25;
export const MARKER_OPACITY_SELECTED = 0.32;
// A hint, not a stand-in for selection — half the real selected opacity,
// same multiplier/opacity every zone (including Reception) uses once truly
// selected, so nothing reads "more selected than the rest" (see markerState
// below — Reception's own selected state never overrides this).
const MARKER_OPACITY_HINT = MARKER_OPACITY_SELECTED * 0.5;

// Click-affordance: Reception's marker plays a one-shot, self-clearing demo
// the first time the map section enters the viewport — draws in, holds,
// fades back to the same clean default every other unselected zone has.
// Not persistent: nothing lingers after it fades, and it never repeats.
// HINT_ZONE_ID must be a real zone id. Exported so SpaceMapper.tsx can drive
// the viewport-trigger timeline that hands `hintActive` down to this plan.
export const HINT_ZONE_ID = "reception";
export const HINT_DELAY_MS = 800;
const HINT_DRAW_S = 1.6;
export const HINT_HOLD_S = 2.5;
const HINT_FADE_S = 2.2;
export const HINT_TOTAL_S = HINT_DRAW_S + HINT_HOLD_S + HINT_FADE_S;

type ZoneShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

// Room bounds, ported 1:1 from the approved design's sketch-plan SVG
// (viewBox 0 0 800 600) — replaces the old abstract rect/circle layout.
const zoneShapes: Record<string, ZoneShape> = {
  reception: { kind: "rect", x: 88, y: 98, width: 214, height: 134, rx: 4 },
  "meeting-room": { kind: "rect", x: 318, y: 98, width: 234, height: 134, rx: 4 },
  "open-floor": { kind: "rect", x: 88, y: 248, width: 464, height: 94, rx: 4 },
  "break-room": { kind: "rect", x: 88, y: 358, width: 224, height: 104, rx: 4 },
  "signature-corner": { kind: "circle", cx: 588, cy: 385, r: 68 },
};

// Paint (and DOM/tab) order: corridor sits in back, the signature corner
// renders last so it visually sits forward as "the one true point" — the
// circle's hit-area overlaps the corridor's visible area (see the padding
// override below), so it must paint after it.
const zoneRenderOrder = [
  "open-floor",
  "reception",
  "meeting-room",
  "break-room",
  "signature-corner",
];

const HIT_AREA_PADDING = 20;

// Signature Corner's visible radius (68 units) already renders above the
// ~44px touch-target minimum on its own. The usual +20 padding would extend
// its hit-circle to r=88, which overlaps the open-floor corridor's visible
// area (the circle sits inside the corridor's right end) with a hit-area
// that wins on paint order, so clicks there would go to the circle even
// where the corridor is what's visually showing. No padding here removes
// that false-hit ring; every other zone still gets the padding since none
// of them sit on top of another zone's visible area the way the circle
// sits on the corridor.
const hitAreaPaddingOverrides: Record<string, number> = {
  "signature-corner": 0,
};

// Marker-highlight strokes drawn over each room — a soft "highlighter on
// paper" look. Coordinates, colors and rotation ported 1:1 from the design.
interface MarkerGroup {
  transform: string;
  color: string;
  lines: { x1: number; y1: number; x2: number; y2: number }[];
}

const zoneMarkerGroups: Record<string, MarkerGroup> = {
  reception: {
    transform: "rotate(-2 195 165)",
    color: "#C9962A",
    lines: [
      { x1: 106, y1: 120, x2: 280, y2: 118 },
      { x1: 100, y1: 143, x2: 288, y2: 142 },
      { x1: 107, y1: 166, x2: 282, y2: 165 },
      { x1: 102, y1: 189, x2: 286, y2: 189 },
      { x1: 110, y1: 211, x2: 272, y2: 212 },
    ],
  },
  "meeting-room": {
    transform: "rotate(-1.5 435 165)",
    color: "#7A9A5B",
    lines: [
      { x1: 334, y1: 120, x2: 538, y2: 118 },
      { x1: 330, y1: 143, x2: 542, y2: 142 },
      { x1: 336, y1: 166, x2: 536, y2: 165 },
      { x1: 332, y1: 189, x2: 540, y2: 189 },
      { x1: 340, y1: 211, x2: 528, y2: 212 },
    ],
  },
  "open-floor": {
    transform: "rotate(-1 320 295)",
    color: "#5FA88C",
    lines: [
      { x1: 102, y1: 264, x2: 536, y2: 262 },
      { x1: 98, y1: 287, x2: 542, y2: 286 },
      { x1: 104, y1: 310, x2: 538, y2: 309 },
      { x1: 100, y1: 331, x2: 530, y2: 331 },
    ],
  },
  "break-room": {
    transform: "rotate(-2 200 410)",
    color: "#C4703C",
    lines: [
      { x1: 102, y1: 376, x2: 296, y2: 374 },
      { x1: 98, y1: 398, x2: 302, y2: 397 },
      { x1: 104, y1: 420, x2: 298, y2: 419 },
      { x1: 100, y1: 441, x2: 290, y2: 441 },
    ],
  },
  "signature-corner": {
    transform: "rotate(-2 588 385)",
    color: "#9A7A8C",
    lines: [
      { x1: 558, y1: 332, x2: 618, y2: 330 },
      { x1: 542, y1: 354, x2: 634, y2: 352 },
      { x1: 528, y1: 376, x2: 644, y2: 375 },
      { x1: 528, y1: 398, x2: 644, y2: 397 },
      { x1: 540, y1: 420, x2: 634, y2: 419 },
      { x1: 558, y1: 441, x2: 618, y2: 441 },
    ],
  },
};

// Palette legend swatch — same zone marker colors, in the order the
// design lists them (Reception, Meeting room, Open floor, Break room,
// Signature corner), not the corridor-first paint order used elsewhere.
const PALETTE_SWATCHES = [
  { hex: "C9962A", color: "#C9962A", y: 100 },
  { hex: "7A9A5B", color: "#7A9A5B", y: 124 },
  { hex: "5FA88C", color: "#5FA88C", y: 148 },
  { hex: "C4703C", color: "#C4703C", y: 172 },
  { hex: "9A7A8C", color: "#9A7A8C", y: 196 },
];

const zoneHoverColor: Record<string, string> = {
  reception: "rgba(201,150,42,0.12)",
  "meeting-room": "rgba(157,176,123,0.12)",
  "open-floor": "rgba(95,168,140,0.14)",
  "break-room": "rgba(192,133,82,0.12)",
  "signature-corner": "rgba(184,150,90,0.12)",
};

// On-map label + area-caption position, ported 1:1 from the design —
// offset from each room's geometric center for visual balance alongside
// the surrounding sketch artwork, not derived from the shape bounds.
const zoneLabelInfo: Record<
  string,
  { x: number; y: number; fontSize: number; sqmX: number; sqmY: number; sqm: string }
> = {
  reception: { x: 226, y: 146, fontSize: 22, sqmX: 226, sqmY: 168, sqm: "≈ 28 m²" },
  "meeting-room": { x: 435, y: 140, fontSize: 22, sqmX: 435, sqmY: 174, sqm: "≈ 32 m²" },
  "open-floor": { x: 240, y: 292, fontSize: 22, sqmX: 240, sqmY: 314, sqm: "≈ 96 m²" },
  "break-room": { x: 200, y: 400, fontSize: 22, sqmX: 200, sqmY: 422, sqm: "≈ 24 m²" },
  "signature-corner": { x: 588, y: 376, fontSize: 20, sqmX: 588, sqmY: 398, sqm: "≈ 14 m²" },
};

interface ShapeExtraProps {
  className: string;
  role?: string;
  tabIndex?: number;
  "aria-pressed"?: boolean;
  "aria-labelledby"?: string;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<SVGElement>) => void;
}

function renderHitArea(
  shape: ZoneShape,
  extra: ShapeExtraProps,
  titleText: string,
  padding: number
) {
  if (shape.kind === "circle") {
    return (
      <circle cx={shape.cx} cy={shape.cy} r={shape.r + padding} {...extra}>
        <title>{titleText}</title>
      </circle>
    );
  }
  return (
    <rect
      x={shape.x - padding}
      y={shape.y - padding}
      width={shape.width + padding * 2}
      height={shape.height + padding * 2}
      rx={shape.rx + padding}
      {...extra}
    >
      <title>{titleText}</title>
    </rect>
  );
}

function getShapeCenter(shape: ZoneShape) {
  return shape.kind === "circle"
    ? { cx: shape.cx, cy: shape.cy }
    : { cx: shape.x + shape.width / 2, cy: shape.y + shape.height / 2 };
}

// Visually hidden (but still in the accessibility tree via opacity, not
// display/visibility) text carrying the full name + tagline — what
// aria-labelledby points to for the accessible name.
function renderHiddenA11yLabel(shape: ZoneShape, id: string, text: string) {
  const { cx, cy } = getShapeCenter(shape);
  return (
    <text id={`${id}-a11y-label`} x={cx} y={cy} className="pointer-events-none opacity-0">
      {text}
    </text>
  );
}

function renderHoverTint(shape: ZoneShape, color: string) {
  const style: CSSProperties = { transition: "fill .2s" };
  if (shape.kind === "circle") {
    return (
      <circle
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        fill="transparent"
        className="pointer-events-none peer-hover:fill-[var(--hover-color)]"
        style={{ ...style, ["--hover-color" as string]: color }}
      />
    );
  }
  return (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      rx={shape.rx}
      fill="transparent"
      className="pointer-events-none peer-hover:fill-[var(--hover-color)]"
      style={{ ...style, ["--hover-color" as string]: color }}
    />
  );
}

type MarkerState = "none" | "hint" | "selected" | "preview";

function renderMarkerGroup(zoneId: string, state: MarkerState, reduced: boolean) {
  const group = zoneMarkerGroups[zoneId];
  const targetOpacity =
    state === "selected" || state === "preview"
      ? MARKER_OPACITY_SELECTED
      : state === "hint"
        ? MARKER_OPACITY_HINT
        : 0;
  const isVisible = state !== "none";
  return (
    <g
      transform={group.transform}
      stroke={group.color}
      strokeWidth={20}
      strokeLinecap="round"
      className="pointer-events-none"
    >
      {group.lines.map((line, index) => {
        if (reduced) {
          return (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              opacity={targetOpacity}
            />
          );
        }
        if (state === "hint") {
          // One-shot draw → hold → fade timeline, self-clearing — see
          // HINT_* constants. Strokes draw one at a time (each starts only
          // once the previous has fully drawn), not as an overlapping
          // wave — HINT_DRAW_S is the total budget for all strokes, so each
          // one gets an equal slice of it. Hold/fade then happen in sync
          // for every stroke regardless of when its own draw finished,
          // which is why each line needs its own local `duration`/`times`
          // (its remaining wait for the others to finish drawing, plus the
          // shared hold and fade, all relative to its own start).
          const lineCount = group.lines.length;
          const strokeDrawS = HINT_DRAW_S / lineCount;
          const ownDelay = index * strokeDrawS;
          const ownDuration = (lineCount - index) * strokeDrawS + HINT_HOLD_S + HINT_FADE_S;
          const drawEndFrac = strokeDrawS / ownDuration;
          const holdEndFrac = ((lineCount - index) * strokeDrawS + HINT_HOLD_S) / ownDuration;
          return (
            <motion.line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: [0, 1, 1, 1], opacity: [0, MARKER_OPACITY_HINT, MARKER_OPACITY_HINT, 0] }}
              transition={{
                duration: ownDuration,
                delay: ownDelay,
                times: [0, drawEndFrac, holdEndFrac, 1],
                ease: "easeOut",
              }}
            />
          );
        }
        return (
          <motion.line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            initial={false}
            animate={isVisible ? { pathLength: 1, opacity: targetOpacity } : { pathLength: 0, opacity: 0 }}
            transition={
              isVisible
                ? {
                    pathLength: { duration: MARKER_DRAW_DURATION, delay: index * MARKER_STAGGER, ease: "easeOut" },
                    opacity: { duration: MARKER_DRAW_DURATION, delay: index * MARKER_STAGGER },
                  }
                : {
                    // Fade out at full drawn length (no reverse draw), then
                    // snap pathLength back to 0 once invisible so the next
                    // selection draws in fresh from the start.
                    opacity: { duration: MARKER_FADE_DURATION },
                    pathLength: { duration: 0, delay: MARKER_FADE_DURATION },
                  }
            }
          />
        );
      })}
    </g>
  );
}

export type SpaceMapperPlanMode = "interactive" | "preview";

interface SpaceMapperPlanProps {
  mode: SpaceMapperPlanMode;
  lang: Lang;
  t: Translations;
  selectedIds: string[];
  onToggleZone?: (id: string) => void;
  hintActive?: boolean;
  prefersReducedMotion: boolean;
  showPalette?: boolean;
  padding?: string;
  rotate?: boolean;
}

// Single SVG plan, rendered in one of two modes so the markup never has to
// be duplicated between the desktop map and the mobile preview/sheet views
// (batch K, item 3): `interactive` is the map as it always was — clickable
// hit-areas, hover tint, the Reception hint cycle; `preview` strips all of
// that down to a static picture (no hit-areas/hover/click, markers render
// at their current opacity with no draw/fade animation and never show the
// Reception hint, since the hint's viewport trigger lives with the
// interactive instance only).
export default function SpaceMapperPlan({
  mode,
  lang,
  t,
  selectedIds,
  onToggleZone,
  hintActive = false,
  prefersReducedMotion,
  showPalette = true,
  padding = "1.75rem",
  rotate = true,
}: SpaceMapperPlanProps) {
  const interactive = mode === "interactive";

  return (
    <div
      className="border border-[#2A2620]/[0.12] bg-paper shadow-[0_1px_2px_rgba(27,46,31,0.08),0_6px_14px_rgba(27,46,31,0.07),0_22px_44px_rgba(27,46,31,0.09)]"
      style={{ padding, transform: rotate ? "rotate(-0.4deg)" : undefined }}
    >
      <svg
        viewBox="0 0 800 600"
        width="100%"
        role="img"
        aria-label={
          interactive
            ? "Interactive office space map with five zones"
            : "Preview of the office space map"
        }
        style={{ overflow: "visible" }}
      >
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

        {zoneRenderOrder.map((id) => {
          const zone = spaceZones.find((z) => z.id === id)!;
          const shape = zoneShapes[id];
          const isSelected = selectedIds.includes(id);
          const markerState: MarkerState = !interactive
            ? "preview"
            : isSelected
              ? "selected"
              : id === HINT_ZONE_ID && hintActive
                ? "hint"
                : "none";
          const content = zoneContent(zone, lang);

          return (
            <g key={id}>
              {interactive &&
                renderHitArea(
                  shape,
                  {
                    role: "button",
                    tabIndex: 0,
                    "aria-pressed": isSelected,
                    "aria-labelledby": `${id}-a11y-label`,
                    onClick: () => onToggleZone?.(id),
                    onKeyDown: (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleZone?.(id);
                      }
                    },
                    className: "peer cursor-pointer fill-transparent outline-none focus-visible:stroke-gold focus-visible:stroke-[4]",
                  },
                  `${content.name}: ${content.tagline}`,
                  hitAreaPaddingOverrides[id] ?? HIT_AREA_PADDING
                )}
              {interactive && renderHiddenA11yLabel(shape, id, `${content.name}: ${content.tagline}`)}
              {interactive && renderHoverTint(shape, zoneHoverColor[id])}
              {renderMarkerGroup(id, markerState, interactive ? prefersReducedMotion : true)}
            </g>
          );
        })}

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

        {/* Palette swatch — zone marker colors as a legend, top-right under
            the compass. Hidden inside the mobile sheet (showPalette=false):
            it reads as illegible clutter at that width and the viewBox
            can't change, so the space is just left empty rather than
            rescaling anything around it. */}
        {showPalette && (
          <g aria-hidden="true" transform="rotate(-2 630 128)" style={{ pointerEvents: "none" }}>
            <text x={605} y={84} className="font-marker" fontSize={16} fill="#2A2620">
              {t.map.paletteLabel}
            </text>
            {PALETTE_SWATCHES.map((row) => (
              <g key={row.hex}>
                <line
                  x1={610}
                  y1={row.y}
                  x2={652}
                  y2={row.y}
                  stroke={row.color}
                  strokeWidth={14}
                  opacity={0.45}
                  strokeLinecap="round"
                />
                <text x={662} y={row.y + 4} className="font-marker" fontSize={13} fill="rgba(42,38,32,0.55)">
                  {row.hex}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Labels — room names, area captions, entry/N markers, signature caption. */}
        <g aria-hidden="true" className="font-marker" style={{ pointerEvents: "none", userSelect: "none" }}>
          {zoneRenderOrder.map((id) => {
            const zone = spaceZones.find((z) => z.id === id)!;
            const content = zoneContent(zone, lang);
            const info = zoneLabelInfo[id];
            return (
              <g key={id}>
                <text x={info.x} y={info.y} textAnchor="middle" fontSize={info.fontSize} fill="#2A2620">
                  {content.name}
                </text>
                <text x={info.sqmX} y={info.sqmY} textAnchor="middle" fontSize={14} fill="rgba(42,38,32,0.55)">
                  {info.sqm}
                </text>
              </g>
            );
          })}

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
      </svg>
    </div>
  );
}
