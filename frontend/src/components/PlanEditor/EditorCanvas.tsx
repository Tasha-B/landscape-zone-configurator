import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dragHandle, handlesOf, moveShape, sameShape, type Handle } from "../../lib/editor/geometry";
import { toPlanPoint } from "../../lib/editor/pointer";
import type { PlanResponse, ZoneResponse } from "../../lib/api/types";
import type { Lang } from "../../lib/i18n/translations";
import { center } from "../../lib/plan/geometry";
import type { Point, Shape } from "../../lib/plan/types";
import { renderShape, withAlpha } from "../Plan/shapes";
import { PlanBackground } from "../SpaceMapper/PlanBackground";

// A drag in progress: the shape as it was when it started, and where the
// pointer went down, in viewBox units
interface Drag {
  zoneId: string;
  handle: Handle | null; // null: the whole zone moves
  start: Shape;
  origin: Point;
}

// The shape shown instead of the plan's while a zone is dragged, and after
// it is released until the plan shows the saved shape (the pending change
// reaches the plan a moment later, so without this the zone would jump back
// for a frame)
interface Draft {
  zoneId: string;
  shape: Shape;
  released: boolean;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const HANDLE_CURSORS: Record<string, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  radius: "ew-resize",
};

interface EditorCanvasProps {
  plan: PlanResponse;
  lang: Lang;
  label: string;
  selectedId: string | null;
  onSelect: (zoneId: string | null) => void;
  onShapeChange: (zoneId: string, shape: Shape) => void;
  // Increases when a change could not be saved: a released draft is dropped,
  // and the plan's own shape shows again
  saveErrors: number;
}

// The plan being edited: its background faintly, each zone as its outline in
// its color, and handles on the selected zone. Pointer events cover mouse,
// pen and touch; a change is saved when the pointer is released.
export default function EditorCanvas({
  plan,
  lang,
  label,
  selectedId,
  onSelect,
  onShapeChange,
  saveErrors,
}: EditorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Paint and tab order, as on the showcase
  const zones = useMemo(() => plan.zones.toSorted((a, b) => a.zIndex - b.zIndex), [plan.zones]);
  const shapeOf = (zone: ZoneResponse) => (draft?.zoneId === zone.id ? draft.shape : zone.shape);

  // A released draft goes once the plan shows its shape or the zone is gone,
  // and when a save fails (the plan shows the server's shape again).
  // Adjusted during render, as React recommends for state that follows props.
  const [seenSaveErrors, setSeenSaveErrors] = useState(saveErrors);
  if (draft?.released) {
    const zone = plan.zones.find((item) => item.id === draft.zoneId);
    if (!zone || sameShape(zone.shape, draft.shape) || saveErrors !== seenSaveErrors) setDraft(null);
  }
  if (saveErrors !== seenSaveErrors) setSeenSaveErrors(saveErrors);

  function pointAt(event: PointerEvent): Point {
    return toPlanPoint(event.clientX, event.clientY, svgRef.current!.getBoundingClientRect(), plan.viewBox);
  }

  function startDrag(event: PointerEvent, zone: ZoneResponse, handle: Handle | null) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect(zone.id);
    svgRef.current?.setPointerCapture?.(event.pointerId);
    const start = shapeOf(zone);
    setDrag({ zoneId: zone.id, handle, start, origin: pointAt(event) });
    setDraft({ zoneId: zone.id, shape: start, released: false });
  }

  // The dragged shape with the pointer where `event` has it
  function shapeAt(event: PointerEvent, { handle, start, origin }: Drag): Shape {
    const [x, y] = pointAt(event);
    return handle === null
      ? moveShape(start, x - origin[0], y - origin[1], plan.viewBox)
      : dragHandle(start, handle, [x, y], plan.viewBox);
  }

  function moveDrag(event: PointerEvent) {
    if (drag) setDraft({ zoneId: drag.zoneId, shape: shapeAt(event, drag), released: false });
  }

  // Released: saved if it changed, with the pointer where it was released; a
  // click without a move only selects. A cancelled pointer (the browser took
  // over the gesture) puts the zone back.
  function endDrag(event: PointerEvent, cancelled: boolean) {
    if (!drag) return;
    svgRef.current?.releasePointerCapture?.(event.pointerId);
    setDrag(null);
    const shape = shapeAt(event, drag);
    if (cancelled || sameShape(shape, drag.start)) {
      setDraft(null);
      return;
    }
    onShapeChange(drag.zoneId, shape);
    setDraft({ zoneId: drag.zoneId, shape, released: true });
  }

  function zoneKeyDown(event: KeyboardEvent, zone: ZoneResponse) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(zone.id);
      return;
    }
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    onSelect(zone.id);
    const step = event.shiftKey ? 10 : 1;
    const shape = moveShape(zone.shape, arrow[0] * step, arrow[1] * step, plan.viewBox);
    if (!sameShape(shape, zone.shape)) onShapeChange(zone.id, shape);
  }

  const [, , width, height] = plan.viewBox;
  // Handles keep the same size relative to the sheet
  const handleSize = Math.max(width, height) / 100;
  const selected = zones.find((zone) => zone.id === selectedId);

  return (
    <svg
      ref={svgRef}
      viewBox={plan.viewBox.join(" ")}
      width="100%"
      role="group"
      aria-label={label}
      className="block touch-none select-none"
      onPointerDown={(event) => event.button === 0 && onSelect(null)}
      onPointerMove={moveDrag}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      onKeyDown={(event) => event.key === "Escape" && onSelect(null)}
    >
      <g opacity={0.35} style={{ pointerEvents: "none" }}>
        <PlanBackground background={plan.background ?? undefined} />
      </g>

      {zones.map((zone) => {
        const shape = shapeOf(zone);
        const isSelected = zone.id === selectedId;
        const name = zone.content[lang].name;
        return (
          <g
            key={zone.id}
            role="button"
            tabIndex={0}
            aria-label={name}
            aria-pressed={isSelected}
            className="group cursor-move outline-none"
            onPointerDown={(event) => startDrag(event, zone, null)}
            onKeyDown={(event) => zoneKeyDown(event, zone)}
          >
            {renderShape(shape, {
              fill: withAlpha(zone.color, isSelected ? 0.3 : 0.18),
              stroke: zone.color,
              strokeWidth: isSelected ? 3 : 2,
              strokeDasharray: isSelected ? "8 5" : undefined,
              vectorEffect: "non-scaling-stroke",
              className: "group-focus-visible:stroke-gold-dark",
            })}
          </g>
        );
      })}

      {/* Names, above every zone and out of the pointer's way */}
      <g aria-hidden="true" className="font-marker" style={{ pointerEvents: "none" }}>
        {zones.map((zone) => {
          const [cx, cy] = center(shapeOf(zone));
          return (
            <text
              key={zone.id}
              x={cx + (zone.label?.dx ?? 0)}
              y={cy + (zone.label?.dy ?? 0)}
              textAnchor="middle"
              fontSize={zone.label?.fontSize ?? 22}
              fill="#2A2620"
            >
              {zone.content[lang].name}
            </text>
          );
        })}
      </g>

      {selected && (
        <g aria-hidden="true">
          {handlesOf(shapeOf(selected)).map(({ handle, x, y }) => (
            <rect
              key={String(handle)}
              data-handle={handle}
              x={x - handleSize / 2}
              y={y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="#FAF7EF"
              stroke="#1B2E1F"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: typeof handle === "number" ? "move" : HANDLE_CURSORS[handle] }}
              onPointerDown={(event) => startDrag(event, selected, handle)}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
