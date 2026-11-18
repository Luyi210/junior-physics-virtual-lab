import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { formatMeasurement } from '../experiments/workbench';
import { Block, Rod, Label } from './ScenePrimitives3D';
import { SPRING_SCENE, springSceneGeometry } from './springSceneGeometry';

export function SpringApparatus3D({ naturalLength, length, loadMassGrams }: { naturalLength: number; length: number; loadMassGrams: number }) {
  const scene = useMemo(() => springSceneGeometry(naturalLength, length), [naturalLength, length]);
  return <group>
    <Block position={[0, -1.3, 0]} size={[3.6, .2, 2.5]} color="#c2c9af" />
    <Rod start={[-1, -1.2, -.3]} end={[-1, 2.95, -.3]} radius={.06} />
    <Rod start={[-1, 2.8, -.3]} end={[0, 2.8, 0]} radius={.045} />
    <Line points={scene.coilPoints} lineWidth={4} color="#48674f" />
    <Block position={[.75, 1, -.08]} size={[.32, 3.78, .08]} color="#e3d7b8" />
    {scene.ticks.map((tick) => <group key={tick.centimetres}><Line points={[[.6, tick.worldY, -.02], [tick.major ? .79 : .7, tick.worldY, -.02]]} color="#667555" lineWidth={1} />{tick.centimetres % 10 === 0 && <Label position={[1, tick.worldY, 0]}>{tick.centimetres}</Label>}</group>)}
    <Label position={[1, -.98, 0]}>cm</Label>
    <Line points={[[-.6, scene.worldNaturalEnd, 0], [.6, scene.worldNaturalEnd, 0]]} color="#8d9a7d" dashed dashSize={.08} gapSize={.05} />
    <Line points={[[0, scene.worldEnd, 0], [.6, scene.worldEnd, 0]]} color="#b5683d" lineWidth={2} />
    <Line points={[[-.5, scene.worldTop, 0], [-.6, scene.worldTop, 0], [-.6, scene.worldNaturalEnd, 0], [-.5, scene.worldNaturalEnd, 0]]} color="#768a69" lineWidth={1} />
    <Label position={[-1.5, (scene.worldTop + scene.worldNaturalEnd) / 2, 0]}>L₀ {formatMeasurement(naturalLength * 100)} cm</Label>
    {length > naturalLength && <><Line points={[[1.3, scene.worldNaturalEnd, 0], [1.4, scene.worldNaturalEnd, 0], [1.4, scene.worldEnd, 0], [1.3, scene.worldEnd, 0]]} color="#b5683d" lineWidth={2} /><Label position={[2.3, (scene.worldNaturalEnd + scene.worldEnd) / 2, 0]}>x {formatMeasurement((length - naturalLength) * 100)} cm</Label></>}
    {loadMassGrams > 0 && <><Rod start={[0, scene.worldEnd, 0]} end={[0, scene.worldEnd - .08, 0]} radius={.018} color="#415e47" /><mesh position={scene.weightCenter} castShadow><cylinderGeometry args={[.24, .24, SPRING_SCENE.weightHeight, 24]} /><meshStandardMaterial color="#b96b3b" metalness={.6} roughness={.35} /></mesh><Label position={[-1, scene.weightCenter[1] - .15, .15]}>{formatMeasurement(loadMassGrams)} g</Label></>}
    <Label position={[0, 3.35, 0]}>静态弹簧 · 固定刻度比例</Label>
  </group>;
}
