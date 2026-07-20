import { useEffect, useRef, useState } from "react";

const spectrum = ["#ff6c5d", "#ffa552", "#f1cf57", "#60d58a", "#54c8e8", "#6387ee", "#aa72dc"];
const scenes = [
  { key: "light", title: "光现象 · 三棱镜色散", note: "白光进入棱镜，不同色光沿不同方向传播" },
  { key: "sound", title: "声现象 · 振动与波", note: "声源振动，波形向前传播" },
  { key: "mechanics", title: "运动与力 · 单摆", note: "重力作用下，摆球周期性往复运动" },
  { key: "circuit", title: "电与磁 · 闭合电路", note: "开关闭合后，电流沿完整路径运动" },
  { key: "thermal", title: "热与物态 · 分子运动", note: "温度升高，微观粒子运动更加剧烈" },
  { key: "matter", title: "质量与密度 · 物质结构", note: "从微观结构出发认识不同物质" },
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
  const pivotX = width * .5;
  const pivotY = height * .17;
  const length = height * .53;
  const angle = Math.sin(phase * 1.15) * .62;
  const bobX = pivotX + Math.sin(angle) * length;
  const bobY = pivotY + Math.cos(angle) * length;
  ctx.save();
  ctx.setLineDash([5, 7]);
  line(ctx, pivotX, pivotY, pivotX, pivotY + length, "rgba(226,236,231,.24)", 1);
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, length, Math.PI * .31, Math.PI * .69);
  ctx.strokeStyle = "rgba(229,178,77,.28)";
  ctx.stroke();
  ctx.restore();
  line(ctx, pivotX - 55, pivotY, pivotX + 55, pivotY, "rgba(221,234,229,.72)", 4);
  line(ctx, pivotX, pivotY, bobX, bobY, "rgba(236,241,232,.9)", 2);
  glowDot(ctx, bobX, bobY, 18, "#e5b24d");
  ctx.fillStyle = "rgba(229,178,77,.85)";
  ctx.font = "700 13px serif";
  ctx.fillText(`θ = ${(angle * 180 / Math.PI).toFixed(0)}°`, width * .72, height * .31);
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

function drawMatter(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const cx = width * .5;
  const cy = height * .51;
  const rx = Math.min(width * .27, height * .36);
  const ry = rx * .42;
  [-.58, .58, Math.PI / 2].forEach((rotation, index) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = index === 2 ? "rgba(164,133,222,.54)" : "rgba(103,224,202,.48)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const angle = phase * (index % 2 ? -1.3 : 1.18) + index * 2.1;
    glowDot(ctx, Math.cos(angle) * rx, Math.sin(angle) * ry, 6, index === 2 ? "#aa86df" : "#6de0cb");
    ctx.restore();
  });
  glowDot(ctx, cx - 7, cy, 14, "#efb957");
  glowDot(ctx, cx + 11, cy + 5, 11, "#e46d55");
  glowDot(ctx, cx + 4, cy - 12, 9, "#65cfe0");
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

const drawers = [drawLight, drawSound, drawMechanics, drawCircuit, drawThermal, drawMatter, drawLens, drawLever, drawBuoyancy, drawMagnet];

export function DashboardPhysicsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setSceneIndex((value) => (value + 1) % scenes.length), 5200);
    return () => window.clearInterval(timer);
  }, [paused]);

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
      const dpr = Math.min(2, window.devicePixelRatio || 1);
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
      if (time - lastTime >= 1000 / 45) {
        draw(time);
        lastTime = time;
      }
      frame = window.requestAnimationFrame(animate);
    };
    const restart = () => {
      window.cancelAnimationFrame(frame);
      if (paused) draw(performance.now());
      else frame = window.requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(() => { resize(); draw(performance.now()); });
    observer.observe(canvas);
    reducedMotion.addEventListener("change", restart);
    resize();
    restart();
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", restart);
      window.cancelAnimationFrame(frame);
    };
  }, [paused, sceneIndex]);

  const scene = scenes[sceneIndex];
  return <>
    <canvas ref={canvasRef} className="dashboard-physics-canvas" aria-hidden="true" />
    <div className="canvas-scene-caption" aria-live="polite"><small>{String(sceneIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")} · AUTO SCENE</small><strong>{scene.title}</strong><span>{scene.note}</span></div>
    <nav className="canvas-scene-tabs" aria-label="选择动态物理场景">{scenes.map((item, index) => <button className={sceneIndex === index ? "active" : ""} onClick={() => setSceneIndex(index)} aria-label={`切换到${item.title}`} title={item.title} key={item.key}>{String(index + 1).padStart(2, "0")}</button>)}</nav>
    <button className={`canvas-motion-toggle ${paused ? "paused" : "running"}`} onClick={() => setPaused((value) => !value)} aria-pressed={paused}><i />{paused ? "继续自动切换" : "自动轮播中 · 点击暂停"}</button>
  </>;
}
