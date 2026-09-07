export function wheelPosition(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(1, (width - 16) / 584, (height - 16) / 584);
  const radius = 292 * scale;
  return {
    x: Math.max(radius + 8, Math.min(width - radius - 8, x)),
    y: Math.max(radius + 8, Math.min(height - radius - 8, y)),
    scale,
  };
}

export function wheelSegment(
  index: number,
  count: number,
  inner: number,
  outer: number,
) {
  const middle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  const half = Math.PI / count - 0.018;
  const point = (r: number, a: number) =>
    `${Math.cos(a) * r},${Math.sin(a) * r}`;
  return {
    path: `M${point(inner, middle - half)} L${point(outer, middle - half)} A${outer},${outer} 0 0 1 ${point(outer, middle + half)} L${point(inner, middle + half)} A${inner},${inner} 0 0 0 ${point(inner, middle - half)} Z`,
    x: (Math.cos(middle) * (inner + outer)) / 2,
    y: (Math.sin(middle) * (inner + outer)) / 2,
  };
}
