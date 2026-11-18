import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";

type Point3 = [number, number, number];
const surfaces = {
  paint: { roughness: .44, metalness: .18 },
  metal: { roughness: .26, metalness: .62 },
  wood: { roughness: .82, metalness: .02 },
} as const;

export function Block({ position, size, color = "#74846a", surface = "paint" }: { position: Point3; size: Point3; color?: string; surface?: keyof typeof surfaces }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} {...surfaces[surface]} /></mesh>;
}

export function Rod({ start, end, radius = .028, color = "#586d56" }: { start: Point3; end: Point3; radius?: number; color?: string }) {
  const geometry = useMemo(() => {
    const from = new Vector3(...start);
    const to = new Vector3(...end);
    const direction = to.clone().sub(from);
    return { position: from.add(to).multiplyScalar(.5), rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()), length: Math.max(.001, direction.length()) };
  }, [...start, ...end]);
  return <mesh position={geometry.position} quaternion={geometry.rotation} castShadow><cylinderGeometry args={[radius, radius, geometry.length, 16]} /><meshStandardMaterial color={color} {...surfaces.metal} /></mesh>;
}

export function Label({ position, children }: { position: Point3; children: React.ReactNode }) {
  return <Html position={position} center distanceFactor={10} style={{ pointerEvents: "none" }}><span className="hs-3d-label">{children}</span></Html>;
}
