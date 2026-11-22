import { arrow, glowDot, line } from "./primitives";

export function drawLens(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const axisY = height * .54;
  const lensX = width * .51;
  const focalLength = width * .13;
  const objectX = width * (.18 + Math.sin(phase * .55) * .018);
  const objectHeight = height * .24;
  const imageX = width * (.81 - Math.sin(phase * .55) * .012);
  const imageHeight = height * .19;
  line(ctx, width * .07, axisY, width * .93, axisY, "rgba(215,230,227,.4)", 1.5);
  [lensX - focalLength, lensX + focalLength].forEach((x) => {
    glowDot(ctx, x, axisY, 3, "#f0bd55");
    ctx.fillStyle = "rgba(240,189,85,.78)";
    ctx.font = "700 10px serif";
    ctx.fillText("F", x - 3, axisY + 17);
  });
  ctx.beginPath();
  ctx.moveTo(lensX, height * .2);
  ctx.bezierCurveTo(lensX - width * .055, height * .31, lensX - width * .055, height * .72, lensX, height * .84);
  ctx.bezierCurveTo(lensX + width * .055, height * .72, lensX + width * .055, height * .31, lensX, height * .2);
  ctx.closePath();
  ctx.fillStyle = "rgba(94,199,226,.13)";
  ctx.strokeStyle = "rgba(118,222,242,.86)";
  ctx.lineWidth = 2.2;
  ctx.fill();
  ctx.stroke();
  const objectTopY = axisY - objectHeight;
  const imageTipY = axisY + imageHeight;
  arrow(ctx, objectX, axisY, objectX, objectTopY, "#efb957");
  arrow(ctx, imageX, axisY, imageX, imageTipY, "#e46d55");
  line(ctx, objectX, objectTopY, lensX, objectTopY, "#67ddcb", 2);
  line(ctx, lensX, objectTopY, imageX, imageTipY, "#67ddcb", 2);
  line(ctx, objectX, objectTopY, lensX, axisY, "#8fb8ef", 2);
  line(ctx, lensX, axisY, imageX, imageTipY, "#8fb8ef", 2);
  for (let index = 0; index < 3; index += 1) {
    const p = (phase * .36 + index / 3) % 1;
    const x = objectX + (imageX - objectX) * p;
    const y = p < .5
      ? objectTopY + (axisY - objectTopY) * p * 2
      : axisY + (imageTipY - axisY) * (p - .5) * 2;
    glowDot(ctx, x, y, 3, "#d9fbff");
  }
}

export function drawLever(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const cx = width * .5;
  const cy = height * .54;
  const beamHalf = width * .34;
  const tilt = Math.sin(phase * .9) * .025;
  const leftY = cy - tilt * beamHalf;
  const rightY = cy + tilt * beamHalf;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 4);
  ctx.lineTo(cx - 34, cy + height * .21);
  ctx.lineTo(cx + 34, cy + height * .21);
  ctx.closePath();
  ctx.fillStyle = "rgba(240,189,85,.22)";
  ctx.strokeStyle = "#f0bd55";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  line(ctx, cx - beamHalf, leftY, cx + beamHalf, rightY, "#dceae5", 8);
  glowDot(ctx, cx, cy, 7, "#f0bd55");
  const leftX = cx - beamHalf * .72;
  const rightX = cx + beamHalf * .54;
  const leftHookY = cy + (leftX - cx) * tilt;
  const rightHookY = cy + (rightX - cx) * tilt;
  line(ctx, leftX, leftHookY, leftX, leftHookY + 43, "rgba(219,231,227,.7)", 2);
  line(ctx, rightX, rightHookY, rightX, rightHookY + 43, "rgba(219,231,227,.7)", 2);
  ctx.fillStyle = "#65cfe0";
  ctx.fillRect(leftX - 18, leftHookY + 43, 36, 30);
  ctx.fillStyle = "#e46d55";
  ctx.fillRect(rightX - 25, rightHookY + 43, 50, 30);
  ctx.save();
  ctx.setLineDash([4, 5]);
  line(ctx, leftX, cy - 35, cx, cy - 35, "rgba(101,219,198,.45)", 1);
  line(ctx, cx, cy - 35, rightX, cy - 35, "rgba(228,109,85,.45)", 1);
  ctx.restore();
  ctx.fillStyle = "rgba(220,234,229,.82)";
  ctx.font = "700 12px KaiTi, STKaiti, serif";
  ctx.fillText("F₁ × l₁", leftX - 23, cy - 46);
  ctx.fillText("F₂ × l₂", rightX - 20, cy - 46);
}

export function drawBuoyancy(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const left = width * .18;
  const right = width * .82;
  const top = height * .2;
  const bottom = height * .84;
  const waterY = height * .43;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right, top);
  ctx.strokeStyle = "rgba(190,220,225,.65)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(47,151,208,.2)";
  ctx.fillRect(left + 2, waterY, right - left - 4, bottom - waterY - 2);
  ctx.beginPath();
  for (let x = left; x <= right; x += 5) {
    const y = waterY + Math.sin((x - left) * .045 + phase * 2) * 3;
    if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(91,198,234,.88)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const blockX = width * .5;
  const blockY = waterY - 8 + Math.sin(phase * 1.4) * 8;
  ctx.fillStyle = "rgba(239,185,87,.88)";
  ctx.strokeStyle = "#ffe1a0";
  ctx.lineWidth = 2;
  ctx.fillRect(blockX - 43, blockY - 32, 86, 64);
  ctx.strokeRect(blockX - 43, blockY - 32, 86, 64);
  arrow(ctx, blockX - 13, blockY + 5, blockX - 13, blockY - 83, "#67ddcb", "F浮");
  arrow(ctx, blockX + 13, blockY - 5, blockX + 13, blockY + 83, "#e46d55", "G");
  for (let index = 0; index < 8; index += 1) {
    const rise = (phase * .16 + index / 8) % 1;
    const x = left + width * .07 + (index % 4) * width * .15;
    const y = bottom - rise * (bottom - waterY);
    ctx.beginPath();
    ctx.arc(x, y, 2 + index % 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(180,235,250,.6)";
    ctx.stroke();
  }
}

export function drawMagnet(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const cx = width * .5;
  const cy = height * .52;
  const coreWidth = width * .37;
  const coreHeight = height * .15;
  ctx.fillStyle = "rgba(191,207,207,.22)";
  ctx.strokeStyle = "rgba(221,233,230,.7)";
  ctx.lineWidth = 2;
  ctx.fillRect(cx - coreWidth / 2, cy - coreHeight / 2, coreWidth, coreHeight);
  ctx.strokeRect(cx - coreWidth / 2, cy - coreHeight / 2, coreWidth, coreHeight);
  const turns = 9;
  for (let index = 0; index < turns; index += 1) {
    const x = cx - coreWidth * .42 + index * (coreWidth * .84 / (turns - 1));
    ctx.beginPath();
    ctx.ellipse(x, cy, width * .025, height * .19, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,110,85,.88)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, coreWidth * (.62 + ring * .18), height * (.22 + ring * .1), 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(101,219,198,${.55 - ring * .12})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = "#66dfc8";
  ctx.font = "800 17px serif";
  ctx.fillText("N", cx - coreWidth / 2 - 27, cy + 6);
  ctx.fillStyle = "#e46d55";
  ctx.fillText("S", cx + coreWidth / 2 + 15, cy + 6);
  for (let index = 0; index < 8; index += 1) {
    const p = (phase * .22 + index / 8) % 1;
    const angle = p * Math.PI * 2;
    const ring = index % 3;
    const x = cx + Math.cos(angle) * coreWidth * (.62 + ring * .18);
    const y = cy + Math.sin(angle) * height * (.22 + ring * .1);
    glowDot(ctx, x, y, 3.5, "#b7fff0");
  }
  ctx.fillStyle = "rgba(232,110,85,.86)";
  ctx.font = "700 11px KaiTi, STKaiti, serif";
  ctx.fillText("线圈中的电流", cx - 42, cy - height * .25);
}
