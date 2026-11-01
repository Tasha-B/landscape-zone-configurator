import type { ReactNode, SVGAttributes } from "react";
import type { Shape } from "../../lib/plan/types";

// Drawing a zone's shape, shared by the showcase and the editor

export function renderShape(shape: Shape, props: SVGAttributes<SVGElement>, children?: ReactNode) {
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

export function withAlpha(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
