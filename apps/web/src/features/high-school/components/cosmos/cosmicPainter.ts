import {
  COSMIC_CLOUD, COSMIC_HEIGHT, COSMIC_NEBULA, COSMIC_RINGS, COSMIC_STARS,
  COSMIC_SURFACE, COSMIC_WAVE_FREQUENCY, COSMIC_WAVE_NUMBER, COSMIC_WIDTH,
  COSMIC_GLOBE_RADIUS, COSMIC_LIGHT, COSMIC_LIMB_ANGLE,
  cosmicDiffuseLight, cosmicOrbitPoint, cosmicOrbitRibbon, cosmicReferenceGrid,
  cosmicRingSegments, cosmicSphereShadow, cosmicWaveAmplitude, cosmicWaveMesh, cosmicWaveView, projectCosmicPoint,
  rotateCosmicPoint, type CosmicMode, type CosmicView,
} from './cosmicGeometry';

type ScreenPoint = { x: number; y: number };
const TAU = Math.PI * 2;

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, strength = .35) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${color},${strength})`);
  gradient.addColorStop(.3, `rgba(${color},${strength * .4})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, points: ScreenPoint[], color: string, width = 1) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.stroke();
}

function polygon(ctx: CanvasRenderingContext2D, points: ScreenPoint[], color: string) {
  if (points.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, view: CosmicView, definition: typeof COSMIC_RINGS[number], front: boolean) {
  for (const piece of cosmicOrbitRibbon(view, definition, front)) {
    polygon(ctx, piece.points, `rgba(${front ? '82,190,224' : '65,119,164'},${piece.opacity})`);
  }
  for (const points of cosmicRingSegments(view, definition, front)) {
    if (front) {
      line(ctx, points, 'rgba(79,191,255,.07)', 13);
      line(ctx, points, 'rgba(92,221,255,.21)', 6);
      line(ctx, points, 'rgba(205,251,255,.93)', 1.15);
    } else {
      line(ctx, points, 'rgba(75,164,236,.1)', 4);
      line(ctx, points, 'rgba(109,197,239,.42)', .8);
    }
  }
}

function background(ctx: CanvasRenderingContext2D, view: CosmicView, time: number) {
  const gradient = ctx.createRadialGradient(335, 198, 15, 325, 210, 360);
  gradient.addColorStop(0, '#102a43');
  gradient.addColorStop(.56, '#08182d');
  gradient.addColorStop(1, '#030916');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, COSMIC_WIDTH, COSMIC_HEIGHT);
  // Low-frequency light-volume drift uses the same suspendable animation clock.
  for (const cloud of COSMIC_NEBULA) {
    const x = cloud.x + Math.sin(time * .045 + cloud.phase) * 12 + view.yaw * 5;
    const y = cloud.y + Math.cos(time * .035 + cloud.phase) * 8;
    glow(ctx, x, y, cloud.radius, cloud.lilac ? '105,72,178' : '27,117,171', cloud.lilac ? .11 : .13);
  }
  for (const star of COSMIC_STARS) {
    const x = star.x + view.yaw * star.depth * 8;
    const y = star.y + view.pitch * star.depth * 8;
    const alpha = star.alpha * (.9 + .1 * Math.sin(time * .4 + star.phase));
    ctx.fillStyle = star.accent ? `rgba(255,207,156,${alpha})` : `rgba(202,232,255,${alpha})`;
    ctx.beginPath(); ctx.arc(x, y, star.r, 0, TAU); ctx.fill();
    if (star.r > 1.16) {
      line(ctx, [{ x: x - 3, y }, { x: x + 3, y }], `rgba(183,230,255,${alpha * .3})`, .5);
      line(ctx, [{ x, y: y - 3 }, { x, y: y + 3 }], `rgba(183,230,255,${alpha * .3})`, .5);
    }
  }
}

function globe(ctx: CanvasRenderingContext2D, view: CosmicView, time: number) {
  const radius = COSMIC_GLOBE_RADIUS;
  glow(ctx, 325, 209, 203, '35,161,224', .38);
  const highlight = { x: 325 + COSMIC_LIGHT.x * 76, y: 209 - COSMIC_LIGHT.y * 76 };
  glow(ctx, highlight.x, highlight.y, 141, '87,224,255', .24);
  const skin = ctx.createRadialGradient(highlight.x, highlight.y, 3, 333, 218, 150);
  skin.addColorStop(0, '#93d9e7'); skin.addColorStop(.18, '#3e9fbb');
  skin.addColorStop(.44, '#19617e'); skin.addColorStop(.76, '#0b304a'); skin.addColorStop(1, '#010712');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(325, 209, radius, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(325, 209, radius - .2, 0, TAU); ctx.clip();
  const spin = { ...view, yaw: view.yaw + time * .038 };
  for (const sample of COSMIC_SURFACE) {
    const rotated = rotateCosmicPoint(sample, spin);
    if (rotated.z > .025) continue;
    const p = projectCosmicPoint(sample, spin, 132);
    const light = cosmicDiffuseLight(rotated);
    const visible = sample.texture > .18;
    ctx.fillStyle = visible ? `rgba(154,242,244,${.06 + light * .6})` : `rgba(66,158,202,${.04 + light * .22})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, visible ? .8 + light * .55 : .45, 0, TAU); ctx.fill();
  }
  // Illuminated, irregular surface ribbons add volume without an image texture.
  for (let latitude = -4; latitude <= 4; latitude += 1) {
    let points: ScreenPoint[] = [];
    for (let index = 0; index <= 120; index += 1) {
      const theta = index * Math.PI / 60;
      const phi = latitude * .17 + Math.sin(theta * 3 + latitude) * .055;
      const p = projectCosmicPoint({ x: Math.cos(phi) * Math.cos(theta), y: Math.sin(phi), z: Math.cos(phi) * Math.sin(theta) }, spin, 132);
      if (p.depth < -.1) points.push(p);
      else { line(ctx, points, 'rgba(92,205,232,.17)', .7); points = []; }
    }
    line(ctx, points, 'rgba(92,205,232,.17)', .7);
  }
  const shadow = cosmicSphereShadow();
  polygon(ctx, shadow.polygon, 'rgba(0,5,15,.69)');
  line(ctx, shadow.terminator, 'rgba(4,22,39,.18)', 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(79,145,177,.22)'; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.arc(325, 209, radius + .5, 0, TAU); ctx.stroke();
  for (const [width, alpha] of [[15, .035], [7, .13], [2.8, .45], [.9, 1]]) {
    ctx.strokeStyle = `rgba(139,242,255,${alpha})`; ctx.lineWidth = width;
    ctx.beginPath(); ctx.arc(325, 209, radius + .5, COSMIC_LIMB_ANGLE - Math.PI * .5, COSMIC_LIMB_ANGLE + Math.PI * .5); ctx.stroke();
  }
}

function orbitScene(ctx: CanvasRenderingContext2D, view: CosmicView, time: number) {
  for (const grid of cosmicReferenceGrid(view)) line(ctx, grid.points, `rgba(98,181,217,${grid.opacity})`, .65);
  for (const definition of COSMIC_RINGS) ring(ctx, view, definition, false);
  const phase = 5.55 + time * .23;
  const satellite = projectCosmicPoint(cosmicOrbitPoint(phase), view);
  const trail = (front: boolean) => {
    const intensity = front ? 1 : .32;
    for (let index = 0; index < 44; index += 1) {
      const fraction = index / 44;
      const a = projectCosmicPoint(cosmicOrbitPoint(phase - .88 + fraction * .88), view);
      const b = projectCosmicPoint(cosmicOrbitPoint(phase - .88 + (index + 1) / 44 * .88), view);
      if ((a.depth < 0) !== front || (b.depth < 0) !== front) continue;
      line(ctx, [a, b], `rgba(255,149,78,${(.02 + fraction * .1) * intensity})`, 9);
      line(ctx, [a, b], `rgba(255,181,105,${(.1 + fraction * .45) * intensity})`, 3.2);
      line(ctx, [a, b], `rgba(255,236,191,${(.1 + fraction * .86) * intensity})`, 1.1);
    }
  };
  trail(false);
  if (satellite.depth >= 0) {
    glow(ctx, satellite.x, satellite.y, 19, '255,174,95', .65);
    ctx.fillStyle = '#ffbd73'; ctx.beginPath(); ctx.arc(satellite.x, satellite.y, 2.5, 0, TAU); ctx.fill();
  }
  globe(ctx, view, time);
  for (const definition of COSMIC_RINGS) ring(ctx, view, definition, true);
  trail(true);
  if (satellite.depth < 0) {
    glow(ctx, satellite.x, satellite.y, 30, '255,158,74', .66);
    glow(ctx, satellite.x, satellite.y, 9, '255,219,160', .9);
    ctx.fillStyle = '#fff6dd'; ctx.beginPath(); ctx.arc(satellite.x, satellite.y, 3.1, 0, TAU); ctx.fill();
  }
}

function waveScene(ctx: CanvasRenderingContext2D, view: CosmicView, time: number) {
  glow(ctx, 325, 209, 222, '44,177,225', .27);
  const waveView = cosmicWaveView(view);
  for (const grid of cosmicReferenceGrid(waveView, -.6)) line(ctx, grid.points, `rgba(91,153,191,${grid.opacity * .65})`, .65);
  const mesh = cosmicWaveMesh(view, time);
  for (const face of mesh.faces) {
    const brightness = Math.round(52 + face.light * 89);
    polygon(ctx, face.points, face.amplitude >= 0 ? `rgba(21,${brightness},166,.72)` : `rgba(49,${Math.round(brightness * .63)},124,.72)`);
    line(ctx, [face.points[0], face.points[1], face.points[2]], `rgba(142,233,251,${.08 + face.light * .26})`, .55);
  }
  for (let row = 0; row < mesh.rows.length; row += 2) {
    for (let column = 0; column < mesh.rows[row].length; column += 2) {
      const p = mesh.rows[row][column], intensity = Math.abs(p.amplitude);
      ctx.fillStyle = p.amplitude >= 0 ? `rgba(181,248,255,${.1 + intensity * .75})` : `rgba(194,174,252,${.1 + intensity * .55})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, (.45 + intensity * .8) * p.scale, 0, TAU); ctx.fill();
    }
  }
  const wavelength = TAU / COSMIC_WAVE_NUMBER;
  const first = (COSMIC_WAVE_FREQUENCY * time % TAU) / COSMIC_WAVE_NUMBER;
  for (const source of [-.66, .66]) {
    for (let index = 0; index < 4; index += 1) {
      const radius = first + index * wavelength;
      if (radius < .02) continue;
      const points = Array.from({ length: 97 }, (_, i) => {
        const x = source + radius * Math.cos(i * Math.PI / 48), z = radius * Math.sin(i * Math.PI / 48);
        return projectCosmicPoint({ x, y: cosmicWaveAmplitude(x, z, time) * .23 + .006, z }, waveView, 134);
      });
      line(ctx, points, `rgba(76,196,241,${Math.max(.025, .2 - radius * .05)})`, 4);
      line(ctx, points, `rgba(138,239,255,${Math.max(.08, .58 - radius * .15)})`, .9);
    }
    const p = projectCosmicPoint({ x: source, y: cosmicWaveAmplitude(source, 0, time) * .23, z: 0 }, waveView, 134);
    glow(ctx, p.x, p.y, 35, '99,229,255', .65);
    ctx.fillStyle = '#f1fcff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU); ctx.fill();
  }
}

function quantumScene(ctx: CanvasRenderingContext2D, view: CosmicView, time: number) {
  const cloudView = { yaw: view.yaw + time * .025, pitch: view.pitch };
  for (const grid of cosmicReferenceGrid(view, -1.85)) line(ctx, grid.points, `rgba(105,157,199,${grid.opacity * .6})`, .6);
  // Light volumes and depth-sorted density points, never orbits or a nucleus.
  for (const lobe of [-1, 1]) {
    for (const height of [.45, .8, 1.1]) {
      const center = projectCosmicPoint({ x: 0, y: height * lobe, z: 0 }, cloudView, 130);
      glow(ctx, center.x, center.y, height === .8 ? 90 : 65, lobe > 0 ? '69,198,255' : '151,112,241', .23);
    }
  }
  const points = COSMIC_CLOUD.map(point => ({ point, p: projectCosmicPoint(point, cloudView, 130) })).sort((a, b) => b.p.depth - a.p.depth);
  for (const { point, p } of points) {
    const depth = Math.max(.14, Math.min(1, (1.6 - p.depth) / 2.6));
    const flicker = .94 + .06 * Math.sin(time * .38 + point.x * 4 + point.y * 3);
    const alpha = Math.min(1, (.1 + point.weight * .85) * depth * flicker);
    ctx.fillStyle = point.lobe > 0 ? `rgba(157,238,255,${alpha})` : `rgba(199,175,255,${alpha * .92})`;
    const radius = (.55 + point.weight * .9) * p.scale;
    if (p.depth > .4) {
      ctx.fillStyle = point.lobe > 0 ? 'rgba(89,175,218,.08)' : 'rgba(151,123,218,.08)';
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 2.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = point.lobe > 0 ? `rgba(157,238,255,${alpha})` : `rgba(199,175,255,${alpha * .92})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
  }
}

function referenceFrame(ctx: CanvasRenderingContext2D, mode: CosmicMode) {
  for (const [x, y, sx, sy] of [[27, 28, 1, 1], [623, 28, -1, 1], [27, 392, 1, -1], [623, 392, -1, -1]]) {
    line(ctx, [{ x: x + sx * 18, y }, { x, y }, { x, y: y + sy * 18 }], 'rgba(119,206,243,.55)', .8);
  }
  for (let index = 0; index <= 20; index += 1) {
    const y = 90 + index * 12;
    line(ctx, [{ x: 27, y }, { x: index % 5 === 0 ? 35 : 31, y }], 'rgba(125,182,215,.32)', .7);
  }
  // Instrument reference only: no circular markings around the probability cloud.
  if (mode === 'orbit') {
    for (let index = 0; index < 60; index += 1) {
      const angle = index * TAU / 60;
      const inner = index % 5 === 0 ? 174 : 177;
      line(ctx, [{ x: 325 + Math.cos(angle) * inner, y: 209 + Math.sin(angle) * inner }, { x: 325 + Math.cos(angle) * 180, y: 209 + Math.sin(angle) * 180 }], 'rgba(105,188,228,.28)', .7);
    }
  }
}

export function paintCosmicObservatory(ctx: CanvasRenderingContext2D, mode: CosmicMode, view: CosmicView, time: number) {
  ctx.clearRect(0, 0, COSMIC_WIDTH, COSMIC_HEIGHT);
  background(ctx, view, time);
  if (mode === 'orbit') orbitScene(ctx, view, time);
  else if (mode === 'waves') waveScene(ctx, view, time);
  else quantumScene(ctx, view, time);
  referenceFrame(ctx, mode);
}
