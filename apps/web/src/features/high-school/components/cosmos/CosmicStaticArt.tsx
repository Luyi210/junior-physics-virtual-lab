import {
  COSMIC_CLOUD, COSMIC_NEBULA, COSMIC_RINGS, COSMIC_STARS, COSMIC_SURFACE,
  COSMIC_LIGHT, COSMIC_LIMB_ANGLE, DEFAULT_COSMIC_VIEW, cosmicDiffuseLight,
  cosmicOrbitPoint, cosmicOrbitRibbon, cosmicReferenceGrid, cosmicRingSegments,
  cosmicSphereShadow, cosmicWaveAmplitude, cosmicWaveMesh, cosmicWaveView,
  projectCosmicPoint, rotateCosmicPoint, type CosmicMode, type CosmicView,
} from './cosmicGeometry';

const pointString = (points: Array<{ x: number; y: number }>) => points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

function ReferencePlane({ view, floor = -1.6, opacity = 1 }: { view: CosmicView; floor?: number; opacity?: number }) {
  return <g aria-hidden="true" opacity={opacity}>{cosmicReferenceGrid(view, floor).map((line, index) =>
    <polyline key={index} points={pointString(line.points)} fill="none" stroke="#62b5d9" strokeWidth=".65" opacity={line.opacity}/>,
  )}</g>;
}

function OrbitArt({ id }: { id: string }) {
  const rings = (front: boolean) => COSMIC_RINGS.map((ring, ringIndex) => <g key={ringIndex}>
    {cosmicOrbitRibbon(DEFAULT_COSMIC_VIEW, ring, front).map((piece, index) =>
      <polygon key={`band-${index}`} points={pointString(piece.points)} fill={front ? '#52bee0' : '#4177a4'} opacity={piece.opacity}/>,
    )}
    {cosmicRingSegments(DEFAULT_COSMIC_VIEW, ring, front).map((points, index) =>
      <g key={`${ringIndex}-${index}`} fill="none">
        <polyline points={pointString(points)} stroke="#63dfff" strokeWidth={front ? 9 : 3} opacity={front ? .17 : .1}/>
        <polyline points={pointString(points)} stroke={front ? '#cdfbff' : '#6bb9e8'} strokeWidth={front ? 1.15 : .8} opacity={front ? .93 : .4}/>
      </g>,
    )}
  </g>);
  const satellite = projectCosmicPoint(cosmicOrbitPoint(5.55), DEFAULT_COSMIC_VIEW);
  const trail = Array.from({ length: 45 }, (_, index) => projectCosmicPoint(cosmicOrbitPoint(5.55 - .88 + index / 44 * .88), DEFAULT_COSMIC_VIEW)).filter(p => p.depth < 0);
  const shadow = cosmicSphereShadow();
  const limb = Array.from({ length: 65 }, (_, index) => {
    const angle = COSMIC_LIMB_ANGLE - Math.PI * .5 + index * Math.PI / 64;
    return { x: 325 + Math.cos(angle) * 133.5, y: 209 + Math.sin(angle) * 133.5 };
  });
  return <>
    <ReferencePlane view={DEFAULT_COSMIC_VIEW}/>
    <g data-cosmic-depth-layer="rear-rings">{rings(false)}</g>
    <circle cx="325" cy="209" r="200" fill={`url(#${id}-halo)`}/>
    <circle data-cosmic-depth-layer="globe" cx="325" cy="209" r="133" fill={`url(#${id}-planet)`}/>
    <g clipPath={`url(#${id}-sphere)`}>
      {COSMIC_SURFACE.map((sample, index) => {
        const rotated = rotateCosmicPoint(sample, DEFAULT_COSMIC_VIEW);
        if (rotated.z > 0) return null;
        const p = projectCosmicPoint(sample, DEFAULT_COSMIC_VIEW, 132);
        const light = cosmicDiffuseLight(rotated);
        return <circle key={index} cx={p.x} cy={p.y} r={sample.texture > .18 ? .8 + light * .55 : .45} fill={sample.texture > .18 ? '#9af2f4' : '#449fc7'} opacity={.06 + light * .6}/>;
      })}
      <polygon points={pointString(shadow.polygon)} fill="#00050f" opacity=".69"/>
      <polyline points={pointString(shadow.terminator)} fill="none" stroke="#041627" strokeWidth="8" opacity=".18"/>
    </g>
    <circle cx="325" cy="209" r="133.5" fill="none" stroke="#4f91b1" strokeWidth=".8" opacity=".22"/>
    <polyline points={pointString(limb)} fill="none" stroke="#72e9ff" strokeWidth="9" opacity=".2" filter={`url(#${id}-soft)`}/>
    <polyline points={pointString(limb)} fill="none" stroke="#b7f7ff" strokeWidth="1.2" opacity=".95"/>
    <g data-cosmic-depth-layer="front-rings">{rings(true)}</g>
    <polyline points={pointString(trail)} fill="none" stroke="#ff9b55" strokeWidth="9" opacity=".18" filter={`url(#${id}-soft)`}/>
    <polyline points={pointString(trail)} fill="none" stroke={`url(#${id}-trail)`} strokeWidth="3"/>
    <polyline points={pointString(trail)} fill="none" stroke="#ffdfb0" strokeWidth=".9"/>
    <circle cx={satellite.x} cy={satellite.y} r="26" fill={`url(#${id}-amber)`}/>
    <circle cx={satellite.x} cy={satellite.y} r="3.1" fill="#fff2d1"/>
    {Array.from({ length: 60 }, (_, index) => {
      const angle = index * Math.PI / 30, inner = index % 5 === 0 ? 174 : 177;
      return <line key={index} x1={325 + Math.cos(angle) * inner} y1={209 + Math.sin(angle) * inner} x2={325 + Math.cos(angle) * 180} y2={209 + Math.sin(angle) * 180} stroke="#78c9ef" strokeWidth=".7" opacity=".3"/>;
    })}
  </>;
}

function WaveArt({ id }: { id: string }) {
  const view = cosmicWaveView(DEFAULT_COSMIC_VIEW);
  const mesh = cosmicWaveMesh(DEFAULT_COSMIC_VIEW, 0);
  return <>
    <circle cx="325" cy="209" r="220" fill={`url(#${id}-halo)`}/>
    <ReferencePlane view={view} floor={-.6} opacity={.65}/>
    {mesh.faces.map((face, index) => {
      const brightness = Math.round(52 + face.light * 89);
      return <polygon key={index} points={pointString(face.points)} fill={face.amplitude >= 0 ? `rgb(21,${brightness},166)` : `rgb(49,${Math.round(brightness * .63)},124)`} fillOpacity=".72" stroke="#8ee9fb" strokeOpacity={.08 + face.light * .26} strokeWidth=".55"/>;
    })}
    {mesh.rows.filter((_, index) => index % 2 === 0).flatMap((row, rowIndex) => row.filter((_, index) => index % 2 === 0).map((p, column) =>
      <circle key={`${rowIndex}-${column}`} cx={p.x} cy={p.y} r={(.45 + Math.abs(p.amplitude) * .8) * p.scale} fill={p.amplitude >= 0 ? '#b5f8ff' : '#c2aefc'} opacity={.1 + Math.abs(p.amplitude) * .7}/>,
    ))}
    {[-.66, .66].map(source => {
      const p = projectCosmicPoint({ x: source, y: cosmicWaveAmplitude(source, 0, 0) * .23, z: 0 }, view, 134);
      return <g key={source}>{[1, 2, 3].map(index => {
        const radius = index * 2 * Math.PI / 9;
        const points = Array.from({ length: 97 }, (_, i) => {
          const x = source + radius * Math.cos(i * Math.PI / 48), z = radius * Math.sin(i * Math.PI / 48);
          return projectCosmicPoint({ x, y: cosmicWaveAmplitude(x, z, 0) * .23 + .006, z }, view, 134);
        });
        return <polyline key={index} points={pointString(points)} fill="none" stroke="#9af1ff" strokeWidth="1" opacity={.55 - index * .1}/>;
      })}<circle cx={p.x} cy={p.y} r="35" fill={`url(#${id}-halo)`}/><circle cx={p.x} cy={p.y} r="3.2" fill="#f0fcff"/></g>;
    })}
  </>;
}

function QuantumArt({ id }: { id: string }) {
  const points = COSMIC_CLOUD.map(point => ({ point, p: projectCosmicPoint(point, DEFAULT_COSMIC_VIEW, 130) })).sort((a, b) => b.p.depth - a.p.depth);
  return <>
    <ReferencePlane view={DEFAULT_COSMIC_VIEW} floor={-1.85} opacity={.6}/>
    {[-1, 1].flatMap(lobe => [.45, .8, 1.1].map(height => {
      const center = projectCosmicPoint({ x: 0, y: lobe * height, z: 0 }, DEFAULT_COSMIC_VIEW, 130);
      return <circle key={`${lobe}-${height}`} cx={center.x} cy={center.y} r={height === .8 ? 90 : 65} fill={`url(#${id}-${lobe > 0 ? 'halo' : 'lilac'})`}/>;
    }))}
    {points.map(({ point, p }, index) => {
      const depth = Math.max(.14, Math.min(1, (1.6 - p.depth) / 2.6));
      const radius = (.55 + point.weight * .9) * p.scale;
      return <g key={index}>
        {p.depth > .4 && <circle cx={p.x} cy={p.y} r={radius * 2.5} fill={point.lobe > 0 ? '#59afda' : '#977bda'} opacity=".08"/>}
        <circle cx={p.x} cy={p.y} r={radius} fill={point.lobe > 0 ? '#9deeff' : '#c7afff'} opacity={(.1 + point.weight * .85) * depth}/>
      </g>;
    })}
  </>;
}

/** Deterministic artwork remains available without Canvas2D or animation. */
export function CosmicStaticArt({ mode, id }: { mode: CosmicMode; id: string }) {
  return <svg className="cosmic-static" viewBox="0 0 650 420" aria-hidden="true" data-cosmic-fallback={mode}>
    <defs>
      <radialGradient id={`${id}-sky`}><stop stopColor="#102a43"/><stop offset=".6" stopColor="#08182d"/><stop offset="1" stopColor="#030916"/></radialGradient>
      <radialGradient id={`${id}-planet`} gradientUnits="userSpaceOnUse" cx="333" cy="218" r="150" fx={325 + COSMIC_LIGHT.x * 76} fy={209 - COSMIC_LIGHT.y * 76}><stop stopColor="#93d9e7"/><stop offset=".18" stopColor="#3e9fbb"/><stop offset=".44" stopColor="#19617e"/><stop offset=".76" stopColor="#0b304a"/><stop offset="1" stopColor="#010712"/></radialGradient>
      <radialGradient id={`${id}-halo`}><stop stopColor="#3fc8ff" stopOpacity=".38"/><stop offset=".3" stopColor="#289cdb" stopOpacity=".2"/><stop offset="1" stopColor="#339ec1" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-lilac`}><stop stopColor="#aa79ff" stopOpacity=".34"/><stop offset=".3" stopColor="#8462cf" stopOpacity=".16"/><stop offset="1" stopColor="#8462cf" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-amber`}><stop stopColor="#ffe3b1" stopOpacity=".9"/><stop offset=".2" stopColor="#ffad64" stopOpacity=".45"/><stop offset="1" stopColor="#ffad64" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-trail`}><stop stopColor="#f18b47" stopOpacity=".1"/><stop offset="1" stopColor="#ffdfb0"/></linearGradient>
      <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      <clipPath id={`${id}-sphere`}><circle cx="325" cy="209" r="132.8"/></clipPath>
    </defs>
    <rect width="650" height="420" fill={`url(#${id}-sky)`}/>
    {COSMIC_NEBULA.map((cloud, index) => <circle key={index} cx={cloud.x} cy={cloud.y} r={cloud.radius} fill={`url(#${id}-${cloud.lilac ? 'lilac' : 'halo'})`} opacity=".35"/>)}
    {COSMIC_STARS.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r} fill={star.accent ? '#ffcb9b' : '#ceeaff'} opacity={star.alpha}/>)}
    {mode === 'orbit' ? <OrbitArt id={id}/> : mode === 'waves' ? <WaveArt id={id}/> : <QuantumArt id={id}/>}
    <path d="M 45 28 H 27 V 46 M 605 28 H 623 V 46 M 45 392 H 27 V 374 M 605 392 H 623 V 374" fill="none" stroke="#77cef3" strokeWidth=".8" opacity=".55"/>
  </svg>;
}
