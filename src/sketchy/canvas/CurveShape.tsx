import { Shape } from "react-konva";

export function CurveShape({
  points,
  stroke,
  strokeWidth,
  opacity = 1,
}: {
  points: number[];
  stroke: string;
  strokeWidth: number;
  opacity?: number;
}) {
  const hit = Math.max(18, strokeWidth * 4);
  return (
    <Shape
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={hit}
      sceneFunc={(context, shape) => {
        if (points.length < 8) return;
        context.beginPath();
        context.moveTo(points[0] ?? 0, points[1] ?? 0);
        context.bezierCurveTo(
          points[2] ?? 0,
          points[3] ?? 0,
          points[4] ?? 0,
          points[5] ?? 0,
          points[6] ?? 0,
          points[7] ?? 0,
        );
        context.strokeShape(shape);
      }}
    />
  );
}
