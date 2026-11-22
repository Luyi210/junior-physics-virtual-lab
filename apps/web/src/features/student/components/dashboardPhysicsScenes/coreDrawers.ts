import { glowDot, line, pointOnCircuit, spectrum } from "./primitives";

export function drawLight(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const cx = width * .47;
  const cy = height * .51;
  const size = Math.min(width * .13, height * .25);
  const pulse = Math.sin(phase * 1.6) * height * .012;
  line(ctx, width * .07, cy, cx - size * .55, cy, "rgba(255,252,222,.94)", 4);
  glowDot(ctx, width * .07, cy, 7, "#fff1a7");
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * .85, cy + size * .72);
  ctx.lineTo(cx - size * .85, cy + size * .72);
  ctx.closePath();
  ctx.fillStyle = "rgba(103,220,213,.13)";
  ctx.strokeStyle = "rgba(132,235,222,.82)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  spectrum.forEach((color, index) => {
    const targetY = cy + (index - 3) * height * .045 + pulse;
    line(ctx, cx + size * .55, cy + pulse, width * .9, targetY, color, 2.3);
  });
  line(ctx, width * .91, height * .24, width * .91, height * .78, "rgba(221,235,232,.62)", 4);
}

export function drawSound(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const sourceX = width * .13;
  const centerY = height * .52;
  ctx.fillStyle = "rgba(20,58,69,.9)";
  ctx.strokeStyle = "rgba(103,173,199,.72)";
  ctx.lineWidth = 2;
  ctx.fillRect(sourceX - 34, centerY - 68, 68, 136);
  ctx.strokeRect(sourceX - 34, centerY - 68, 68, 136);
  ctx.beginPath();
  ctx.arc(sourceX, centerY - 18, 24 + Math.sin(phase * 7) * 3, 0, Math.PI * 2);
  ctx.strokeStyle = "#68b9e8";
  ctx.stroke();
  ctx.beginPath();
  const startX = width * .24;
  const endX = width * .92;
  for (let x = startX; x <= endX; x += 2) {
    const progress = (x - startX) / (endX - startX);
    const envelope = .45 + Math.sin(progress * Math.PI) * .55;
    const y = centerY + Math.sin(progress * Math.PI * 7 - phase * 4.4) * height * .15 * envelope;
    if (x === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(104,196,238,.92)";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#4d9ed4";
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (let index = 0; index < 4; index += 1) {
    const progress = (phase * .34 + index / 4) % 1;
    const x = startX + progress * (endX - startX);
    glowDot(ctx, x, centerY, 3.5, "#c6f2ff");
  }
}

export function drawCircuit(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const left = width * .14;
  const right = width * .86;
  const top = height * .27;
  const bottom = height * .73;
  ctx.strokeStyle = "rgba(232,110,85,.72)";
  ctx.lineWidth = 5;
  ctx.strokeRect(left, top, right - left, bottom - top);
  line(ctx, left - 10, height * .43, left + 10, height * .43, "#f2c16d", 4);
  line(ctx, left - 17, height * .52, left + 17, height * .52, "#f2c16d", 4);
  ctx.beginPath();
  ctx.arc(right, height * .5, 38, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,209,91,.18)";
  ctx.strokeStyle = "#f2c16d";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(right - 20, height * .5);
  ctx.lineTo(right - 8, height * .45);
  ctx.lineTo(right + 8, height * .55);
  ctx.lineTo(right + 20, height * .5);
  ctx.stroke();
  for (let index = 0; index < 12; index += 1) {
    const progress = (phase * .2 + index / 12) % 1;
    const [x, y] = pointOnCircuit(progress, left, top, right, bottom);
    glowDot(ctx, x, y, 4, "#ffe39a");
  }
}

export function drawThermal(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const cx = width * .48;
  const top = height * .24;
  const bottom = height * .78;
  const halfWidth = width * .18;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, top);
  ctx.lineTo(cx - halfWidth * .82, bottom);
  ctx.quadraticCurveTo(cx, bottom + 18, cx + halfWidth * .82, bottom);
  ctx.lineTo(cx + halfWidth, top);
  ctx.strokeStyle = "rgba(181,220,225,.72)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "rgba(65,169,218,.25)";
  ctx.fillRect(cx - halfWidth * .82, height * .5, halfWidth * 1.64, bottom - height * .5);
  for (let index = 0; index < 18; index += 1) {
    const seed = index * 17.17;
    const x = cx - halfWidth * .7 + ((Math.sin(seed) + 1) / 2) * halfWidth * 1.4;
    const travel = (phase * (.22 + index % 4 * .025) + index / 18) % 1;
    const y = bottom - travel * (bottom - top) + Math.sin(phase * 3 + seed) * 5;
    glowDot(ctx, x, y, 3 + index % 3, index % 2 ? "#ffb76a" : "#d8f6ff");
  }
  const tx = width * .78;
  line(ctx, tx, top, tx, bottom, "rgba(222,236,232,.52)", 10);
  line(ctx, tx, bottom, tx, height * (.41 + Math.sin(phase * .7) * .03), "#e87955", 6);
  glowDot(ctx, tx, bottom, 12, "#e87955");
}

export function drawDensity(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const progress = (Math.sin(phase * .72) + 1) / 2;
  const balanceX = width * .25;
  const baseY = height * .73;
  line(ctx, balanceX - width * .14, baseY, balanceX + width * .14, baseY, "rgba(218,232,228,.82)", 5);
  line(ctx, balanceX, baseY - height * .28, balanceX, baseY + 2, "rgba(218,232,228,.65)", 4);
  line(ctx, balanceX - width * .13, baseY - height * .24, balanceX + width * .13, baseY - height * .24, "#f0bd55", 5);
  ctx.beginPath();
  ctx.arc(balanceX - width * .105, baseY - height * .16, width * .048, 0, Math.PI * 2);
  ctx.arc(balanceX + width * .105, baseY - height * .16, width * .048, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(143,216,207,.82)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#a88ae2";
  ctx.fillRect(balanceX - width * .125, baseY - height * .21, width * .04, height * .09);
  ctx.fillStyle = "rgba(236,244,239,.9)";
  ctx.font = "800 12px KaiTi, STKaiti, serif";
  ctx.fillText("m = 62.5 g", balanceX - width * .075, baseY + height * .09);

  const cylinderLeft = width * .61;
  const cylinderRight = width * .82;
  const cylinderTop = height * .18;
  const cylinderBottom = height * .82;
  const waterY = height * (.66 - progress * .14);
  ctx.beginPath();
  ctx.moveTo(cylinderLeft, cylinderTop);
  ctx.lineTo(cylinderLeft, cylinderBottom);
  ctx.lineTo(cylinderRight, cylinderBottom);
  ctx.lineTo(cylinderRight, cylinderTop);
  ctx.strokeStyle = "rgba(195,229,234,.78)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(66,170,220,.26)";
  ctx.fillRect(cylinderLeft + 2, waterY, cylinderRight - cylinderLeft - 4, cylinderBottom - waterY - 2);
  for (let index = 0; index <= 5; index += 1) {
    const y = cylinderBottom - index * (cylinderBottom - cylinderTop) / 6;
    line(ctx, cylinderLeft, y, cylinderLeft + width * .025, y, "rgba(223,240,238,.58)", 1);
  }
  const sampleY = cylinderTop + height * .07 + progress * height * .42;
  ctx.fillStyle = "#a88ae2";
  ctx.fillRect((cylinderLeft + cylinderRight) / 2 - width * .024, sampleY, width * .048, height * .09);
  ctx.fillStyle = "rgba(236,244,239,.9)";
  ctx.font = "800 11px KaiTi, STKaiti, serif";
  ctx.fillText(progress > .52 ? "V₂ = 75 mL" : "V₁ = 50 mL", cylinderLeft - width * .015, cylinderTop - 11);
  ctx.fillStyle = "#67ddcb";
  ctx.font = "900 13px KaiTi, STKaiti, serif";
  ctx.fillText("ρ = m ÷ (V₂−V₁)", width * .39, height * .91);
}
