import { useMemo, type CSSProperties, type ReactNode, type SVGAttributes } from "react";
import { motion } from "framer-motion";
import { PlanAnnotations, PlanBackground, HINT_ZONE_ID } from "./PlanBackground";
import type { Lang, Translations } from "../../lib/i18n/translations";
import { area, center, padShape } from "../../lib/plan/geometry";
import { generateMarkerStrokes, MARKER_STROKE_WIDTH, type MarkerStroke } from "../../lib/plan/markers";
import type { FloorPlan, Shape } from "../../lib/plan/types";

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
// The zone is HINT_ZONE_ID from PlanBackground, where the hint arrow is
// drawn. Exported so SpaceMapper.tsx can drive the viewport-trigger
// timeline that hands `hintActive` down to this plan.
export const HINT_DELAY_MS = 800;
const HINT_DRAW_S = 1.6;
export const HINT_HOLD_S = 2.5;
const HINT_FADE_S = 2.2;
export const HINT_TOTAL_S = HINT_DRAW_S + HINT_HOLD_S + HINT_FADE_S;

// A zone's hit area reaches this far past its outline unless the zone sets
// its own hitPadding (the signature corner uses 0, see demoPlan)
const DEFAULT_HIT_PADDING = 20;
const HOVER_TINT_ALPHA = 0.12;
const LABEL_FONT_SIZE = 22;
const AREA_CAPTION_DY = 22;
const PALETTE_FIRST_Y = 100;
const PALETTE_STEP_Y = 24;

function withAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function renderShape(shape: Shape, props: SVGAttributes<SVGElement>, children?: ReactNode) {
  switch (shape.kind) {
    case "rect":
      return (
        <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...props}>
          {children}
        </rect>
      );
    case "circle":
      return (
        <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...props}>
          {children}
        </circle>
      );
    case "polygon":
      return (
        <polygon points={shape.points.map((point) => point.join(",")).join(" ")} {...props}>
          {children}
        </polygon>
      );
  }
}

// Rects and circles grow by the padding; a polygon keeps its outline and
// gets a transparent stroke 2 × padding wide that still takes the clicks
function renderHitArea(shape: Shape, padding: number, props: SVGAttributes<SVGElement>, titleText: string) {
  const hit = padShape(shape, padding);
  const strokeProps: SVGAttributes<SVGElement> =
    hit.strokeWidth > 0 ? { stroke: "transparent", strokeWidth: hit.strokeWidth, strokeLinejoin: "round" } : {};
  return renderShape(hit.shape, { ...strokeProps, ...props }, <title>{titleText}</title>);
}

// Visually hidden (but still in the accessibility tree via opacity, not
// display/visibility) text carrying the full name + tagline — what
// aria-labelledby points to for the accessible name.
function renderHiddenA11yLabel(shape: Shape, id: string, text: string) {
  const [cx, cy] = center(shape);
  return (
    <text id={`${id}-a11y-label`} x={cx} y={cy} className="pointer-events-none opacity-0">
      {text}
    </text>
  );
}

function renderHoverTint(shape: Shape, color: string) {
  const style: CSSProperties = { transition: "fill .2s", ["--hover-color" as string]: color };
  return renderShape(shape, {
    fill: "transparent",
    className: "pointer-events-none peer-hover:fill-[var(--hover-color)]",
    style,
  });
}

type MarkerState = "none" | "hint" | "selected" | "preview";

function renderMarkerGroup(strokes: MarkerStroke[], color: string, state: MarkerState, reduced: boolean) {
  const targetOpacity =
    state === "selected" || state === "preview"
      ? MARKER_OPACITY_SELECTED
      : state === "hint"
        ? MARKER_OPACITY_HINT
        : 0;
  const isVisible = state !== "none";
  return (
    <g stroke={color} strokeWidth={MARKER_STROKE_WIDTH} strokeLinecap="round" className="pointer-events-none">
      {strokes.map((line, index) => {
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
          const lineCount = strokes.length;
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
  plan: FloorPlan;
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
//
// Everything per zone comes from `plan`; the artwork around the zones is
// PlanBackground.
export default function SpaceMapperPlan({
  plan,
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

  // Paint, DOM and tab order: lowest zIndex first, so the open floor sits in
  // back and the signature corner on top of it
  const zones = useMemo(() => plan.zones.toSorted((a, b) => a.zIndex - b.zIndex), [plan]);
  const markerStrokes = useMemo(
    () => new Map(plan.zones.map((zone) => [zone.id, generateMarkerStrokes(zone.shape, zone.id)])),
    [plan],
  );

  return (
    <div
      className="border border-[#2A2620]/[0.12] bg-paper shadow-[0_1px_2px_rgba(27,46,31,0.08),0_6px_14px_rgba(27,46,31,0.07),0_22px_44px_rgba(27,46,31,0.09)]"
      style={{ padding, transform: rotate ? "rotate(-0.4deg)" : undefined }}
    >
      <svg
        viewBox={plan.viewBox.join(" ")}
        width="100%"
        role="img"
        aria-label={
          interactive
            ? `Interactive office space map with ${plan.zones.length} zones`
            : "Preview of the office space map"
        }
        style={{ overflow: "visible" }}
      >
        {zones.map((zone) => {
          const { id, shape } = zone;
          const isSelected = selectedIds.includes(id);
          const markerState: MarkerState = !interactive
            ? "preview"
            : isSelected
              ? "selected"
              : id === HINT_ZONE_ID && hintActive
                ? "hint"
                : "none";
          const content = zone.content[lang];

          return (
            <g key={id}>
              {interactive &&
                renderHitArea(
                  shape,
                  zone.hitPadding ?? DEFAULT_HIT_PADDING,
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
                )}
              {interactive && renderHiddenA11yLabel(shape, id, `${content.name}: ${content.tagline}`)}
              {interactive && renderHoverTint(shape, withAlpha(zone.color, HOVER_TINT_ALPHA))}
              {renderMarkerGroup(
                markerStrokes.get(id) ?? [],
                zone.color,
                markerState,
                interactive ? prefersReducedMotion : true,
              )}
            </g>
          );
        })}

        <PlanBackground />

        {/* Palette swatch — zone marker colors as a legend, top-right under
            the compass, in plan order. Hidden inside the mobile sheet
            (showPalette=false): it reads as illegible clutter at that width
            and the viewBox can't change, so the space is just left empty
            rather than rescaling anything around it. */}
        {showPalette && (
          <g aria-hidden="true" transform="rotate(-2 630 128)" style={{ pointerEvents: "none" }}>
            <text x={605} y={84} className="font-marker" fontSize={16} fill="#2A2620">
              {t.map.paletteLabel}
            </text>
            {plan.zones.map((zone, index) => {
              const y = PALETTE_FIRST_Y + index * PALETTE_STEP_Y;
              return (
                <g key={zone.id}>
                  <line
                    x1={610}
                    y1={y}
                    x2={652}
                    y2={y}
                    stroke={zone.color}
                    strokeWidth={14}
                    opacity={0.45}
                    strokeLinecap="round"
                  />
                  <text x={662} y={y + 4} className="font-marker" fontSize={13} fill="rgba(42,38,32,0.55)">
                    {zone.color.slice(1).toUpperCase()}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Room names and area captions */}
        <g aria-hidden="true" className="font-marker" style={{ pointerEvents: "none", userSelect: "none" }}>
          {zones.map((zone) => {
            const [cx, cy] = center(zone.shape);
            const x = cx + (zone.label?.dx ?? 0);
            const y = cy + (zone.label?.dy ?? 0);
            const squareMeters = Math.round(area(zone.shape) / plan.pxPerMeter ** 2);
            return (
              <g key={zone.id}>
                <text x={x} y={y} textAnchor="middle" fontSize={zone.label?.fontSize ?? LABEL_FONT_SIZE} fill="#2A2620">
                  {zone.content[lang].name}
                </text>
                <text
                  x={x}
                  y={y + (zone.label?.areaDy ?? AREA_CAPTION_DY)}
                  textAnchor="middle"
                  fontSize={14}
                  fill="rgba(42,38,32,0.55)"
                >
                  ≈ {squareMeters} m²
                </text>
              </g>
            );
          })}
        </g>

        <PlanAnnotations lang={lang} t={t} />
      </svg>
    </div>
  );
}
