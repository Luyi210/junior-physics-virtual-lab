import { Html, Line } from '@react-three/drei';
import type { ReactNode } from 'react';
import { DoubleSide, Quaternion, Vector3 } from 'three';
import { Block, Label, Rod } from '../ScenePrimitives3D';
import { formatMeasurement } from '../../experiments/workbench';
import { safeSceneClick, type Point3 } from './expandedGeometry';

export { Block, Label, Rod };
export function Bench({ children }: { children: ReactNode }) {
  return <group><Block position={[0, -1.15, 0]} size={[8.4, .18, 4.5]} color="#cbc5b4" surface="wood" />{children}<Label position={[0, -1.3, 2.4]}>三维器材与尺寸比例示意 · 读数来自同一物理模型</Label></group>;
}
export function Wire({ points, color = '#a96a42' }: { points: Point3[]; color?: string }) { return <Line points={points} color={color} lineWidth={2} />; }
export function Disc({ position, radius, color = '#476d51', thickness = .12 }: { position: Point3; radius: number; color?: string; thickness?: number }) {
  return <mesh position={position} castShadow><cylinderGeometry args={[radius, radius, thickness, 64]} /><meshStandardMaterial color={color} roughness={.52} metalness={.12} /></mesh>;
}
export function Bead({ position, radius = .15, color = '#b66a3b' }: { position: Point3; radius?: number; color?: string }) {
  return <mesh position={position} castShadow><sphereGeometry args={[radius, 24, 16]} /><meshStandardMaterial color={color} metalness={.58} roughness={.27} /></mesh>;
}
export function TransparentBox({ position, size, color = '#8dc6bd' }: { position: Point3; size: Point3; color?: string }) {
  return <mesh position={position}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.18} metalness={.02} transparent opacity={.2} side={DoubleSide} depthWrite={false} /></mesh>;
}
export function Gauge3D({ position, label, value, unit }: { position: Point3; label: string; value: number; unit: string }) {
  return <group position={position}><Block position={[0, 0, 0]} size={[1.4, .65, .8]} color="#eee8d5" /><Block position={[0, .34, 0]} size={[1.1, .025, .55]} color="#294a51" surface="metal" /><Label position={[0, .55, 0]}>{label} {formatMeasurement(value)} {unit}</Label></group>;
}
export function SceneAction({ position, label, onClick }: { position: Point3; label: string; onClick?: () => void }) {
  return <group position={position}><mesh userData={{ expandedAction: label }} onClick={event => { if (onClick && safeSceneClick(event)) { event.stopPropagation(); onClick(); } }}>
    <cylinderGeometry args={[.23, .27, .12, 24]} /><meshStandardMaterial color={onClick ? '#b76c40' : '#b4baa7'} roughness={onClick ? .3 : .75} metalness={onClick ? .58 : .05} />
  </mesh><Html position={[0, .45, 0]} center><button className="hs-expanded-3d-action" type="button" disabled={!onClick} onClick={onClick}>{label}</button></Html></group>;
}
export function Arrow3D({ start, end, color = '#b7683b' }: { start: Point3; end: Point3; color?: string }) {
  const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2], length = Math.hypot(dx, dy, dz);
  if (length < .0001) return null;
  const headLength = Math.min(.2, length * .35);
  const center: Point3 = [end[0] - dx / length * headLength / 2, end[1] - dy / length * headLength / 2, end[2] - dz / length * headLength / 2];
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx, dy, dz).normalize());
  return <group><Rod start={start} end={end} color={color} radius={.025} /><mesh position={center} quaternion={rotation}><coneGeometry args={[headLength * .4, headLength, 16]} /><meshStandardMaterial color={color} roughness={.36} metalness={.45} /></mesh></group>;
}
