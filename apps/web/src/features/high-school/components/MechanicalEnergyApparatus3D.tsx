import { Line } from '@react-three/drei';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { Block, Rod, Label } from './ScenePrimitives3D';
import { formatMeasurement } from '../experiments/workbench';
import { mechanicalEnergyGeometry, MECHANICAL_ENERGY_GEOMETRY as G } from './mechanicalEnergyGeometry';

export function MechanicalEnergyApparatus3D({ parameters, simulation }: { parameters: Record<string, number>; simulation: HighSchoolSimulation }) {
  const s = simulation.state;
  const scene = mechanicalEnergyGeometry(parameters.dropHeight, s.position);
  const initialEnergy = s.potentialEnergy + s.potentialEnergyLoss;
  const energies = [{ key: 'potentialEnergy', label: '势能', color: '#4f7659' }, { key: 'kineticEnergy', label: '动能', color: '#bd6e3e' }, { key: 'dissipatedEnergy', label: '耗散', color: '#92987b' }];
  return <group>
    <Block position={[0, G.worldFloorY - .1, 0]} size={[3.8, .2, 2]} color="#c3c9b2" />
    <Rod start={[-1.2, G.worldFloorY, -.2]} end={[-1.2, 2.85, -.2]} radius={.055} />
    <Rod start={[-1.2, scene.worldReleaseY + .3, -.2]} end={[G.worldBallX, scene.worldReleaseY + .3, 0]} radius={.045} />
    <Block position={[G.worldBallX, scene.worldReleaseY + .25, 0]} size={[.45, .14, .3]} color="#41614a" />
    <Block position={[.65, (scene.worldReleaseY + scene.worldEndY) / 2, -.05]} size={[.27, scene.worldReleaseY - scene.worldEndY + .15, .08]} color="#e5dbc0" />
    {scene.ticks.map((tick) => <group key={tick.distance}><Line points={[[.51, tick.worldY, .01], [tick.major ? .72 : .62, tick.worldY, .01]]} color="#607553" lineWidth={1} />{tick.major && <Label position={[1, tick.worldY, .04]}>{formatMeasurement(tick.distance, 1)}</Label>}</group>)}
    <Line points={[[G.worldBallX, scene.worldReleaseY, 0], [.5, scene.worldReleaseY, 0]]} color="#829174" dashed dashSize={.05} gapSize={.04} />
    {scene.worldReleaseY > scene.worldY && <Block position={[G.worldBallX, (scene.worldReleaseY + scene.worldY) / 2, -.03]} size={[.07, scene.worldReleaseY - scene.worldY, .012]} color="#e8d5ad" />}
    <mesh position={[G.worldBallX, scene.worldY, 0]} castShadow><sphereGeometry args={[G.worldBallRadius, 24, 24]} /><meshStandardMaterial color="#b96a3b" metalness={.55} roughness={.32} /></mesh>
    <Line points={[[G.worldBallX, scene.worldY, 0], [.5, scene.worldY, 0]]} color="#b96a3b" dashed dashSize={.04} gapSize={.04} />
    <Label position={[-.35, 3.15, 0]}>同步释放 · 装置尺寸示意</Label>
    <Label position={[1, scene.worldReleaseY + .25, .1]}>下降 / m</Label>
    {energies.map((energy, index) => { const value = s[energy.key]; const height = initialEnergy > 0 ? Math.max(0, Math.min(1, value / initialEnergy)) * 1.7 : 0; const x = 2 + index * .65; return <group key={energy.key}><Block position={[x, -.35, -.1]} size={[.33, 1.7, .07]} color="#dde2cf" />{height > 1e-6 && <Block position={[x, -1.2 + height / 2, 0]} size={[.33, height, .15]} color={energy.color} />}<Label position={[x, -1.55, .2]}>{energy.label}</Label><Label position={[x, .8, 0]}>{formatMeasurement(value, 2)} J</Label></group>; })}
    <Label position={[2.6, 1.5, 0]}>同一能量比例 · 耗散另计</Label>
  </group>;
}
