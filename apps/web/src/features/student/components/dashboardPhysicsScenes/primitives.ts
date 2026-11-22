export const spectrum = ["#ff6c5d", "#ffa552", "#f1cf57", "#60d58a", "#54c8e8", "#6387ee", "#aa72dc"];

export function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.save();
  ctx.shadowBlur = radius * 4;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function pointOnCircuit(progress: number, left: number, top: number, right: number, bottom: number) {
  const horizontal = right - left;
  const vertical = bottom - top;
  const perimeter = (horizontal + vertical) * 2;
  let distance = progress * perimeter;
  if (distance <= horizontal) return [left + distance, top] as const;
  distance -= horizontal;
  if (distance <= vertical) return [right, top + distance] as const;
  distance -= vertical;
  if (distance <= horizontal) return [right - distance, bottom] as const;
  return [left, bottom - (distance - horizontal)] as const;
}

export function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, label?: string) {
  line(ctx, x1, y1, x2, y2, color, 3);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 9;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - .55) * size, y2 - Math.sin(angle - .55) * size);
  ctx.lineTo(x2 - Math.cos(angle + .55) * size, y2 - Math.sin(angle + .55) * size);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (label) {
    ctx.fillStyle = color;
    ctx.font = "700 12px KaiTi, STKaiti, serif";
    ctx.fillText(label, x2 + 7, y2 + (y2 < y1 ? -2 : 13));
  }
}
