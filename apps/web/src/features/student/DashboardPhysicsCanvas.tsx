import { useEffect, useRef, useState } from "react";
import { useElementActivity } from "../../hooks/useElementActivity";

const spectrum = ["#ff6c5d", "#ffa552", "#f1cf57", "#60d58a", "#54c8e8", "#6387ee", "#aa72dc"];
const scenes = [
  { key: "light", title: "光现象 · 三棱镜色散", note: "白光进入棱镜，不同色光沿不同方向传播" },
  { key: "sound", title: "声现象 · 振动与波", note: "声源振动，波形向前传播" },
  { key: "mechanics", title: "运动与力 · 杠杆平衡", note: "比较力与力臂共同产生的转动效果" },
  { key: "circuit", title: "电与磁 · 闭合电路", note: "开关闭合后，电流沿完整路径运动" },
  { key: "thermal", title: "热与物态 · 分子运动", note: "温度升高，微观粒子运动更加剧烈" },
  { key: "density", title: "质量与密度 · 排水法测量", note: "用天平测质量，用量筒示数差测体积" },
  { key: "lens", title: "光学应用 · 凸透镜成像", note: "改变物距，观察会聚光线与倒立实像的位置" },
  { key: "lever", title: "简单机械 · 杠杆平衡", note: "动力乘动力臂等于阻力乘阻力臂" },
  { key: "buoyancy", title: "力与运动 · 浮力与浮沉", note: "比较浮力与重力，判断物体的浮沉状态" },
  { key: "magnet", title: "电与磁 · 电磁铁", note: "电流通过线圈，铁芯周围产生磁场" }
] as const;

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.save();
  ctx.shadowBlur = radius * 4;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLight(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawSound(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawMechanics(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  drawLever(ctx, width, height, phase);
}

function pointOnCircuit(progress: number, left: number, top: number, right: number, bottom: number) {
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

function drawCircuit(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawThermal(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawDensity(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, label?: string) {
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

function drawLens(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawLever(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawBuoyancy(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

function drawMagnet(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
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

const drawers = [drawLight, drawSound, drawMechanics, drawCircuit, drawThermal, drawDensity, drawLens, drawLever, drawBuoyancy, drawMagnet];

export type DashboardPhysicsScene = typeof scenes[number]["key"];

interface DashboardPhysicsCanvasProps {
  sceneKey?: DashboardPhysicsScene;
  compact?: boolean;
}

export function DashboardPhysicsCanvas({ sceneKey, compact = false }: DashboardPhysicsCanvasProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useElementActivity(canvasRef, compact ? "120px" : "240px");
  const [paused, setPaused] = useState(false);
  const fixedSceneIndex = sceneKey ? scenes.findIndex((scene) => scene.key === sceneKey) : -1;
  const [sceneIndex, setSceneIndex] = useState(fixedSceneIndex >= 0 ? fixedSceneIndex : 0);

  useEffect(() => {
    if (fixedSceneIndex >= 0) setSceneIndex(fixedSceneIndex);
  }, [fixedSceneIndex]);

  useEffect(() => {
    if (paused || !active || fixedSceneIndex >= 0) return;
    const timer = window.setInterval(() => setSceneIndex((value) => (value + 1) % scenes.length), 5200);
    return () => window.clearInterval(timer);
  }, [active, fixedSceneIndex, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    const transitionStart = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(compact ? 1.25 : 1.5, window.devicePixelRatio || 1);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (time: number) => {
      const motionScale = reducedMotion.matches ? .35 : 1;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalAlpha = Math.min(1, (time - transitionStart) / 620);
      drawers[sceneIndex](context, width, height, time / 1000 * motionScale);
      context.restore();
    };
    const animate = (time: number) => {
      if (time - lastTime >= 1000 / (compact ? 18 : 30)) {
        draw(time);
        lastTime = time;
      }
      frame = window.requestAnimationFrame(animate);
    };
    const restart = () => {
      window.cancelAnimationFrame(frame);
      if (paused || !active || reducedMotion.matches) draw(performance.now());
      else frame = window.requestAnimationFrame(animate);
    };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => { resize(); draw(performance.now()); });
    });
    observer.observe(canvas);
    reducedMotion.addEventListener("change", restart);
    resize();
    restart();
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", restart);
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(frame);
    };
  }, [active, compact, paused, sceneIndex]);

  const scene = scenes[sceneIndex];
  if (compact) return <>
    <canvas ref={canvasRef} className="dashboard-physics-canvas field-preview-canvas" aria-hidden="true" />
    <span className="field-preview-live"><i />动态预览</span>
  </>;

  return <>
    <canvas ref={canvasRef} className="dashboard-physics-canvas" aria-hidden="true" />
    <div className="canvas-scene-caption" aria-live="polite"><small>{String(sceneIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")} · AUTO SCENE</small><strong>{scene.title}</strong><span>{scene.note}</span></div>
    <nav className="canvas-scene-tabs" aria-label="选择动态物理场景">{scenes.map((item, index) => <button className={sceneIndex === index ? "active" : ""} onClick={() => setSceneIndex(index)} aria-label={`切换到${item.title}`} title={item.title} key={item.key}>{String(index + 1).padStart(2, "0")}</button>)}</nav>
    <button className={`canvas-motion-toggle ${paused ? "paused" : "running"}`} onClick={() => setPaused((value) => !value)} aria-pressed={paused}><i />{paused ? "继续自动切换" : "自动轮播中 · 点击暂停"}</button>
  </>;
}
