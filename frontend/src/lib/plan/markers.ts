import { bounds, scanlineIntervals, type Interval } from "./geometry";
import { createRandom } from "./random";
import type { Shape } from "./types";

// Same shape as an SVG <line>, so strokes can be spread onto one
export interface MarkerStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const MARKER_STROKE_WIDTH = 20;

// Measured from the hand-placed strokes of phase 0: with these values the
// phase 0 shapes get the same number of rows they had (5 / 5 / 4 / 4 / 6).
const ROW_SPACING = 22;
const EDGE_MARGIN = 13;
// Round caps reach half the stroke width past the endpoints; on top of that
// each end stops short of the wall. As in the hand-drawn strokes, the left
// end (where the pen lands) hugs the wall closer than the right one.
const CAP = MARKER_STROKE_WIDTH / 2;
const START_INSET_MIN = 0;
const START_INSET_RANGE = 5;
const END_INSET_MIN = 1;
const END_INSET_RANGE = 12;
// Each zone gets one tilt of 1–2°, right end up, capped so long strokes
// do not leave their row
const TILT_MIN_DEG = 1;
const TILT_RANGE_DEG = 1;
const MAX_TILT_RISE = 6;
const ROW_JITTER = 1;
const END_JITTER = 1;
// Endpoints never move further than this from their row
const BAND = ROW_JITTER + MAX_TILT_RISE / 2 + END_JITTER;
const MIN_LENGTH = 8;

function intersect(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const from = Math.max(a[i][0], b[j][0]);
    const to = Math.min(a[i][1], b[j][1]);
    if (to > from) result.push([from, to]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return result;
}

// Runs that are inside the shape for every y in [y − BAND, y + BAND], so a
// stroke kept within one of them and within the band never leaves the
// shape. Rects and circles narrow monotonically towards their edges, so the
// band ends are enough; a polygon's boundary is linear between vertices,
// so its vertices inside the band are sampled too.
function bandIntervals(shape: Shape, y: number): Interval[] {
  const ys = [y - BAND, y, y + BAND];
  if (shape.kind === "polygon") {
    for (const [, vy] of shape.points) {
      if (vy > y - BAND && vy < y + BAND) ys.push(vy);
    }
  }
  return ys
    .map((sampleY) => scanlineIntervals(shape, sampleY))
    .reduce((acc, intervals) => intersect(acc, intervals));
}

// Horizontal highlighter strokes filling the shape, top to bottom and left
// to right. They look hand-drawn, but the same seed always gives the same
// strokes.
export function generateMarkerStrokes(shape: Shape, seed: string): MarkerStroke[] {
  const random = createRandom(seed);
  const jitter = (amount: number) => (random() * 2 - 1) * amount;

  const tilt = Math.tan(((TILT_MIN_DEG + random() * TILT_RANGE_DEG) * Math.PI) / 180);
  const box = bounds(shape);
  const rows = Math.max(1, Math.floor((box.height - 2 * EDGE_MARGIN) / ROW_SPACING) + 1);
  const firstRowY = box.y + (box.height - (rows - 1) * ROW_SPACING) / 2;

  const strokes: MarkerStroke[] = [];
  for (let row = 0; row < rows; row++) {
    const rowY = firstRowY + row * ROW_SPACING + jitter(ROW_JITTER);
    for (const [from, to] of bandIntervals(shape, rowY)) {
      const x1 = from + CAP + START_INSET_MIN + random() * START_INSET_RANGE;
      const x2 = to - CAP - END_INSET_MIN - random() * END_INSET_RANGE;
      const startJitter = jitter(END_JITTER);
      const endJitter = jitter(END_JITTER);
      if (x2 - x1 < MIN_LENGTH) continue;

      const rise = Math.min((x2 - x1) * tilt, MAX_TILT_RISE);
      strokes.push({ x1, y1: rowY + rise / 2 + startJitter, x2, y2: rowY - rise / 2 + endJitter });
    }
  }
  return strokes;
}
