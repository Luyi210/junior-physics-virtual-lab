export type CosmicMode = 'orbit' | 'waves' | 'quantum';
export type CosmicPoint = { x: number; y: number; z: number };
export type CosmicView = { yaw: number; pitch: number };
export const COSMIC_WIDTH = 650;
export const COSMIC_HEIGHT = 420;
export const COSMIC_MAX_BACKING_WIDTH = 1600;
export const DEFAULT_COSMIC_VIEW: CosmicView = { yaw: .18, pitch: -.16 };
export const COSMIC_RINGS = [
  { radius: 1.83, tilt: .32, turn: 0 },
  { radius: 2.15, tilt: .71, turn: .7 },
  { radius: 1.57, tilt: .94, turn: -.8 },
] as const;

export const COSMIC_MODES = {
  orbit: { label: '天体轨道', english: 'ORBITAL FIELD', headline: '引力，让远方彼此关联。', detail: '天体与轨道的空间意象，不对应具体星体或轨道参数。', concept: '宏观尺度', feature: '空间与运动' },
  waves: { label: '波的干涉', english: 'WAVE INTERFERENCE', headline: '相遇的波，叠出新的纹理。', detail: '两同频波场线性叠加的意象；亮暗与颜色呈现相加、相消。', concept: '线性叠加', feature: '相遇与干涉' },
  quantum: { label: '量子云', english: 'PROBABILITY CLOUD', headline: '不画轨道，看分布的形态。', detail: '以点密度呈现概率云意象；点不是电子，动画不是电子运动轨迹。', concept: '概率分布', feature: '密度与形态' },
} as const;

export function clampCosmicView(view: CosmicView): CosmicView {
  return { yaw: Math.max(-1.25, Math.min(1.25, Number.isFinite(view.yaw) ? view.yaw : DEFAULT_COSMIC_VIEW.yaw)), pitch: Math.max(-.62, Math.min(.62, Number.isFinite(view.pitch) ? view.pitch : DEFAULT_COSMIC_VIEW.pitch)) };
}
export function rotateCosmicPoint(point: CosmicPoint, view: CosmicView): CosmicPoint {
  const c = Math.cos(view.yaw), s = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const x = point.x*c + point.z*s, z = -point.x*s + point.z*c;
  return { x, y: point.y*cp-z*sp, z: point.y*sp+z*cp };
}
/** Pseudo-3D camera only; these are artistic scene units, never laboratory data. */
export function projectCosmicPoint(point: CosmicPoint, view: CosmicView, scale = 132) {
  const rotated = rotateCosmicPoint(point, view);
  const perspective = 8 / Math.max(1, 8 + rotated.z);
  return { x: 325 + rotated.x*scale*perspective, y: 209 - rotated.y*scale*perspective, depth: rotated.z, scale: perspective };
}
export function cosmicPointerView(start: CosmicView, dx: number, dy: number, width: number): CosmicView {
  if (![dx,dy,width].every(Number.isFinite) || width <= 0) return start;
  const sensitivity = 2.6 / Math.max(240,width);
  return clampCosmicView({ yaw: start.yaw + dx*sensitivity, pitch: start.pitch + dy*sensitivity });
}
export function cosmicRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525,state)+1013904223) >>> 0; return state / 4294967296; };
}
export const COSMIC_STARS = (()=>{const random=cosmicRandom(731920);return Array.from({length:186},(_,index)=>({x:random()*650,y:random()*420,r:.35+random()*.9,alpha:.15+random()*.55,phase:random()*Math.PI*2,depth:.2+random()*.8,accent:index%31===0}));})();
/** Low-frequency light volumes: decorative nebula, never a laboratory field map. */
export const COSMIC_NEBULA = (() => {
  const random = cosmicRandom(60428);
  return Array.from({ length: 22 }, (_, index) => ({
    x: 75 + index * 24,
    y: 325 - index * 10 + Math.sin(index * .9) * 32,
    radius: 55 + random() * 65,
    phase: random() * Math.PI * 2,
    lilac: index % 4 === 0,
  }));
})();
export const COSMIC_SURFACE = Array.from({length:1700},(_,index)=>{
  const y=1-2*(index+.5)/1700, radial=Math.sqrt(1-y*y),angle=index*Math.PI*(3-Math.sqrt(5));
  const x=radial*Math.cos(angle),z=radial*Math.sin(angle);
  const texture=Math.sin(angle*1.7+Math.sin(y*7)*1.9)+.5*Math.cos(angle*4.3-y*10)+.35*Math.sin(angle*.4+y*21);
  return {x,y,z,texture};
});
/** A deterministic, two-lobed density illustration, not a solved atomic wavefunction. */
export const COSMIC_CLOUD = (()=>{
  const random=cosmicRandom(991836),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());
  return Array.from({length:1500},(_,index)=>{const sign=index%2?1:-1;const x=normal()*.36,z=normal()*.36,y=sign*(.2+Math.min(1.35,Math.abs(normal())*.6));return{x,y,z,weight:.25+random()*.75,lobe:sign};});
})();
export const COSMIC_WAVE_NUMBER = 9;
export const COSMIC_WAVE_FREQUENCY = 1.2;
/** Equal-frequency scalar waves in arbitrary scene units; no wavelength readout. */
export function cosmicWaveAmplitude(x: number, y: number, time: number) {
  const phase=COSMIC_WAVE_FREQUENCY*time;
  const left=Math.cos(COSMIC_WAVE_NUMBER*Math.hypot(x+.66,y)-phase);
  const right=Math.cos(COSMIC_WAVE_NUMBER*Math.hypot(x-.66,y)-phase);
  return (left+right)/2;
}
export function cosmicOrbitPoint(angle: number, radius=1.83, tilt=.32, turn=0): CosmicPoint {
  const x=radius*Math.cos(angle),y=radius*Math.sin(angle)*Math.sin(tilt),z=radius*Math.sin(angle)*Math.cos(tilt);
  return{x:x*Math.cos(turn)+z*Math.sin(turn),y,z:-x*Math.sin(turn)+z*Math.cos(turn)};
}

export type CosmicProjection = ReturnType<typeof projectCosmicPoint>;

/** A camera-space key light shared by the globe, its atmosphere and the wave mesh. */
export const COSMIC_LIGHT: CosmicPoint = { x: -.64, y: .52, z: -.57 };
export const COSMIC_GLOBE_RADIUS = 133;
export const COSMIC_LIMB_ANGLE = Math.atan2(-COSMIC_LIGHT.y, COSMIC_LIGHT.x);

export function cosmicDiffuseLight(normal: CosmicPoint) {
  const length = Math.hypot(normal.x, normal.y, normal.z) * Math.hypot(COSMIC_LIGHT.x, COSMIC_LIGHT.y, COSMIC_LIGHT.z);
  return length > 0 ? Math.max(0, Math.min(1, (normal.x * COSMIC_LIGHT.x + normal.y * COSMIC_LIGHT.y + normal.z * COSMIC_LIGHT.z) / length)) : 0;
}

/** Visible terminator of a lit sphere, in screen coordinates (the camera looks toward +z). */
export function cosmicSphereShadow() {
  const planar = Math.hypot(COSMIC_LIGHT.x, COSMIC_LIGHT.y);
  const direction = { x: COSMIC_LIGHT.x / planar, y: -COSMIC_LIGHT.y / planar };
  const facing = -COSMIC_LIGHT.z / Math.hypot(planar, COSMIC_LIGHT.z);
  const project = (u: number, v: number) => ({
    x: 325 + COSMIC_GLOBE_RADIUS * (u * direction.x - v * direction.y),
    y: 209 + COSMIC_GLOBE_RADIUS * (u * direction.y + v * direction.x),
  });
  const rim = Array.from({ length: 65 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 64;
    return project(-Math.cos(angle), Math.sin(angle));
  });
  const terminator = Array.from({ length: 65 }, (_, index) => {
    const angle = Math.PI / 2 - index * Math.PI / 64;
    return project(-facing * Math.cos(angle), Math.sin(angle));
  });
  return { polygon: [...rim, ...terminator], terminator };
}

/** Finite-width annular strips, rather than flat screen ellipses. Render rear pieces before the globe. */
export function cosmicOrbitRibbon(view: CosmicView, ring: typeof COSMIC_RINGS[number], front: boolean) {
  const pieces: Array<{ points: CosmicProjection[]; depth: number; opacity: number }> = [];
  for (let index = 0; index < 180; index += 1) {
    const a = index * Math.PI / 90, b = (index + 1) * Math.PI / 90;
    const center = projectCosmicPoint(cosmicOrbitPoint((a + b) / 2, ring.radius, ring.tilt, ring.turn), view);
    if ((center.depth < 0) !== front) continue;
    const points = [[a, -.017], [a, .017], [b, .017], [b, -.017]].map(([angle, offset]) =>
      projectCosmicPoint(cosmicOrbitPoint(angle, ring.radius + offset, ring.tilt, ring.turn), view));
    pieces.push({ points, depth: center.depth, opacity: front ? .32 + .28 * Math.min(1, -center.depth / 2) : .12 });
  }
  return pieces.sort((a, b) => b.depth - a.depth);
}

/** A low, receding reference plane: artistic viewing geometry, not field lines or measured coordinates. */
export function cosmicReferenceGrid(view: CosmicView, floor = -1.6) {
  const lines: Array<{ points: CosmicProjection[]; opacity: number }> = [];
  for (let index = -6; index <= 6; index += 1) {
    const x = index * .5;
    lines.push({ points: [-1.4, 3.4].map(z => projectCosmicPoint({ x, y: floor, z }, view, 110)), opacity: .11 });
  }
  for (let index = 0; index <= 8; index += 1) {
    const z = -1.4 + index * .6;
    lines.push({ points: [-3, 3].map(x => projectCosmicPoint({ x, y: floor, z }, view, 110)), opacity: .17 - index * .015 });
  }
  return lines;
}

export function cosmicWaveView(view: CosmicView): CosmicView {
  return { yaw: view.yaw * .65, pitch: -.62 + view.pitch * .28 };
}

/** The same two-source amplitude becomes vertical displacement on a depth-sorted surface. */
export function cosmicWaveMesh(view: CosmicView, time: number) {
  const camera = cosmicWaveView(view);
  const rows = Array.from({ length: 29 }, (_, row) => Array.from({ length: 45 }, (_, column) => {
    const x = -1.9 + column * 3.8 / 44, z = -1.25 + row * 2.5 / 28;
    const amplitude = cosmicWaveAmplitude(x, z, time);
    const world = { x, y: amplitude * .23, z };
    return { ...projectCosmicPoint(world, camera, 134), amplitude, world };
  }));
  const faces = rows.slice(0, -1).flatMap((row, rowIndex) => row.slice(0, -1).map((vertex, column) => {
    const points = [vertex, row[column + 1], rows[rowIndex + 1][column + 1], rows[rowIndex + 1][column]];
    const a = points[1].world, b = points[3].world, origin = vertex.world;
    const dx = a.x - origin.x, dy = a.y - origin.y, dz = b.z - origin.z, by = b.y - origin.y;
    const normal = rotateCosmicPoint({ x: -dy * dz, y: dx * dz, z: -dx * by }, camera);
    return {
      points, depth: points.reduce((sum, point) => sum + point.depth, 0) / 4,
      amplitude: points.reduce((sum, point) => sum + point.amplitude, 0) / 4,
      light: cosmicDiffuseLight(normal),
    };
  })).sort((a, b) => b.depth - a.depth);
  return { rows, faces };
}

/** Shared with the SVG fallback, including the same front/back occlusion. */
export function cosmicRingSegments(
  view: CosmicView,
  ring: { radius: number; tilt: number; turn: number },
  front: boolean,
): CosmicProjection[][] {
  const segments: CosmicProjection[][] = [];
  let part: CosmicProjection[] = [];
  for (let index = 0; index <= 180; index += 1) {
    const point = projectCosmicPoint(cosmicOrbitPoint(index * Math.PI / 90, ring.radius, ring.tilt, ring.turn), view);
    if ((point.depth < 0) === front) part.push(point);
    else if (part.length) { segments.push(part); part = []; }
  }
  if (part.length) segments.push(part);
  return segments.filter(points => points.length > 1);
}

/** These numbers describe the user's camera input, not simulated physical data. */
export function cosmicViewDegrees(view: CosmicView) {
  return { yaw: view.yaw * 180 / Math.PI, pitch: view.pitch * 180 / Math.PI };
}

/** Expanded viewing must not make the per-frame raster budget unbounded. */
export function cosmicBackingSize(cssWidth: number, devicePixelRatio: number) {
  const width = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : COSMIC_WIDTH;
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, Math.min(1.5, devicePixelRatio)) : 1;
  const pixelWidth = Math.max(1, Math.min(COSMIC_MAX_BACKING_WIDTH, Math.round(width * dpr)));
  return { width: pixelWidth, height: Math.max(1, Math.round(pixelWidth * COSMIC_HEIGHT / COSMIC_WIDTH)) };
}
