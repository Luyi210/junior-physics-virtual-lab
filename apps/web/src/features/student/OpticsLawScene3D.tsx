import { Grid, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Quaternion, Vector3, type Mesh } from "three";
import { useElementActivity } from "../../hooks/useElementActivity";

type ViewPreset = "perspective" | "front" | "top";
type SceneNavigation = "rotate" | "zoom";

interface SceneFrameProps {
  ariaLabel: string;
  children: React.ReactNode;
  onInteract?: () => void;
  onNavigate?: (action: SceneNavigation) => void;
  onViewChange?: (view: ViewPreset) => void;
  badges: string[];
}

interface ReflectionSceneProps {
  angle: number;
  roughness: number;
  interacted: boolean;
  onInteract?: () => void;
  onNavigate?: (action: SceneNavigation) => void;
  onViewChange?: (view: ViewPreset) => void;
}

interface RefractionSceneProps {
  angle: number;
  refractionAngle: number | null;
  totalInternalReflection: boolean;
  topMedium: string;
  bottomMedium: string;
  interacted: boolean;
  onInteract?: () => void;
  onNavigate?: (action: SceneNavigation) => void;
  onViewChange?: (view: ViewPreset) => void;
}

interface PlaneMirrorSceneProps {
  objectDistance: number;
  observerPosition: number;
  screenPlaced: boolean;
  interacted: boolean;
  onInteract?: () => void;
  onNavigate?: (action: SceneNavigation) => void;
  onViewChange?: (view: ViewPreset) => void;
}

interface CurvedMirrorSceneProps {
  mirror: "concave" | "convex";
  objectDistance: number;
  imageDistance: number;
  magnification: number;
  real: boolean;
  atFocus: boolean;
  nature: string;
  interacted: boolean;
  onInteract?: () => void;
  onNavigate?: (action: SceneNavigation) => void;
  onViewChange?: (view: ViewPreset) => void;
}

type LensApparatus = "magnifier" | "bench" | "camera" | "eye" | "correction" | "telescope" | "microscope";

interface LensSystemSceneProps {
  apparatus: LensApparatus;
  objectDistance: number;
  focalLength: number;
  imageDistance: number;
  magnification: number;
  real: boolean;
  nature: string;
  interacted: boolean;
  screenDistance?: number;
  secondFocalLength?: number;
  correctionLens?: "none" | "convex" | "concave";
  correctionEffective?: boolean;
  onInteract?: () => void;
  onNavigate?: (action: SceneNavigation) => void;
  onViewChange?: (view: ViewPreset) => void;
}

type Point3 = [number, number, number];

const viewPositions: Record<ViewPreset, Point3> = {
  perspective: [7.4, 5.5, 8.8],
  front: [0, 1.7, 11.5],
  top: [0.01, 11.5, 0.01]
};

function CameraRig({ view }: { view: ViewPreset }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...viewPositions[view]);
    camera.lookAt(0, .25, 0);
    camera.updateProjectionMatrix();
  }, [camera, view]);
  return null;
}

function BeamPulse({ start, end, color, delay = 0 }: { start: Point3; end: Point3; color: string; delay?: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * .42 + delay) % 1;
    ref.current.position.set(
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
      start[2] + (end[2] - start[2]) * t
    );
  });
  return <mesh ref={ref}>
    <sphereGeometry args={[.09, 16, 16]} />
    <meshBasicMaterial color={color} toneMapped={false} />
    <pointLight color={color} intensity={1.7} distance={1.4} />
  </mesh>;
}

function BeamDirectionArrow({ start, end, color, virtual = false, opacity = 1 }: { start: Point3; end: Point3; color: string; virtual?: boolean; opacity?: number }) {
  const transform = useMemo(() => {
    const startVector = new Vector3(...start);
    const endVector = new Vector3(...end);
    const direction = endVector.clone().sub(startVector).normalize();
    const position = startVector.clone().lerp(endVector, .68);
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction);
    return { position, quaternion };
  }, [end, start]);
  return <mesh position={transform.position} quaternion={transform.quaternion} renderOrder={4}>
    <coneGeometry args={[virtual ? .105 : .13, virtual ? .3 : .38, 18]} />
    <meshBasicMaterial color={color} transparent opacity={virtual ? opacity * .72 : opacity} wireframe={virtual} depthWrite={!virtual} toneMapped={false} />
  </mesh>;
}

function PhotonBeam({ start, end, color, delay = 0, dashed = false, opacity = 1 }: { start: Point3; end: Point3; color: string; delay?: number; dashed?: boolean; opacity?: number }) {
  return <>
    <Line points={[start, end]} color={color} lineWidth={3.2} transparent opacity={opacity} dashed={dashed} dashScale={7} dashSize={.35} gapSize={.2} />
    <BeamDirectionArrow start={start} end={end} color={color} virtual={dashed} opacity={opacity} />
    {!dashed && <BeamPulse start={start} end={end} color={color} delay={delay} />}
  </>;
}

function AngleArc({ angle, side, color, lower = false }: { angle: number; side: "left" | "right"; color: string; lower?: boolean }) {
  const points = useMemo<Point3[]>(() => {
    const segments = 28;
    const radians = angle * Math.PI / 180;
    return Array.from({ length: segments + 1 }, (_, index) => {
      const theta = radians * index / segments;
      const xDirection = side === "left" ? -1 : 1;
      return [xDirection * Math.sin(theta) * .95, (lower ? -1 : 1) * Math.cos(theta) * .95, .025];
    });
  }, [angle, lower, side]);
  return <Line points={points} color={color} lineWidth={2} />;
}

function SceneFrame({ ariaLabel, children, onInteract, onNavigate, onViewChange, badges }: SceneFrameProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const active = useElementActivity(stageRef, "260px");
  const [view, setView] = useState<ViewPreset>("perspective");
  const lastNavigation = useRef<Record<SceneNavigation, number>>({ rotate: 0, zoom: 0 });
  const reportNavigation = (action: SceneNavigation) => {
    onInteract?.();
    const now = performance.now();
    if (now - lastNavigation.current[action] < 900) return;
    lastNavigation.current[action] = now;
    onNavigate?.(action);
  };
  const changeView = (preset: ViewPreset) => {
    if (preset === view) return;
    setView(preset);
    onInteract?.();
    onViewChange?.(preset);
  };
  return <div ref={stageRef} className="optics-3d-stage" role="img" aria-label={ariaLabel} onPointerDown={() => reportNavigation("rotate")} onWheel={() => reportNavigation("zoom")}>
    <Canvas shadows dpr={[1, 1.45]} frameloop={active ? "always" : "never"} camera={{ position: viewPositions.perspective, fov: 43, near: .1, far: 100 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <color attach="background" args={["#06171f"]} />
      <fog attach="fog" args={["#06171f", 12, 25]} />
      <ambientLight intensity={.7} />
      <directionalLight position={[4, 8, 5]} intensity={2.1} castShadow />
      <pointLight position={[-5, 3, 4]} intensity={1.2} color="#72d9ff" />
      <Grid position={[0, -.18, 0]} args={[18, 18]} cellSize={.5} cellThickness={.45} cellColor="#234853" sectionSize={2} sectionThickness={.8} sectionColor="#3f6a74" fadeDistance={17} fadeStrength={1.2} infiniteGrid />
      {children}
      <CameraRig view={view} />
      <OrbitControls makeDefault target={[0, .25, 0]} enableDamping dampingFactor={.08} minDistance={5.5} maxDistance={16} minPolarAngle={.08} maxPolarAngle={Math.PI * .88} />
    </Canvas>
    <div className="optics-3d-toolbar" aria-label="三维观察视角">
      {(["perspective", "front", "top"] as ViewPreset[]).map((preset) => <button className={view === preset ? "active" : ""} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); changeView(preset); }} key={preset}>{preset === "perspective" ? "空间视角" : preset === "front" ? "正视光路" : "俯视实验台"}</button>)}
    </div>
    <div className="optics-3d-badges">{badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
    <div className="optics-3d-help"><b>3D</b><span>拖动旋转 · 滚轮缩放 · 点击上方按钮切换视角</span></div>
  </div>;
}

function MeasurementPlane() {
  return <mesh position={[0, 1.75, .04]}>
    <planeGeometry args={[8.6, 4.2]} />
    <meshBasicMaterial color="#77d6e8" transparent opacity={.025} side={DoubleSide} depthWrite={false} />
  </mesh>;
}

export function ReflectionScene3D({ angle, roughness, interacted, onInteract, onNavigate, onViewChange }: ReflectionSceneProps) {
  const radians = angle * Math.PI / 180;
  const length = 4.2;
  const origin: Point3 = [0, 0, 0];
  const incident: Point3 = [-Math.sin(radians) * length, Math.cos(radians) * length, 0];
  const reflected: Point3 = [Math.sin(radians) * length, Math.cos(radians) * length, 0];
  const scattered = roughness > 10 ? [-3, -2, -1, 1, 2, 3].map((offset): Point3 => {
    const scatterAngle = Math.max(-84, Math.min(84, angle + offset * roughness / 16));
    const scatterRadians = scatterAngle * Math.PI / 180;
    return [Math.sin(scatterRadians) * length, Math.cos(scatterRadians) * length, offset * roughness / 145];
  }) : [];

  return <SceneFrame ariaLabel="可旋转缩放的光反射三维实验场景" onInteract={onInteract} onNavigate={onNavigate} onViewChange={onViewChange} badges={[`入射角 ${angle.toFixed(0)}°`, `反射角 ${angle.toFixed(0)}°`, roughness < 12 ? "镜面反射" : "漫反射"]}>
    <MeasurementPlane />
    <mesh position={[0, -.08, 0]} receiveShadow castShadow>
      <boxGeometry args={[8.6, .16, 6.2]} />
      <meshPhysicalMaterial color={roughness < 12 ? "#81939b" : "#5f6c70"} metalness={.88} roughness={Math.max(.06, roughness / 100)} clearcoat={roughness < 12 ? 1 : .2} />
    </mesh>
    <Line points={[[0, -.08, 0], [0, 4.25, 0]]} color="#d7e4e7" lineWidth={1.6} dashed dashScale={6} dashSize={.35} gapSize={.22} />
    <mesh position={origin}><sphereGeometry args={[.11, 18, 18]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
    {interacted && <>
      <PhotonBeam start={incident} end={origin} color="#ffd36b" delay={0} />
      <PhotonBeam start={origin} end={reflected} color="#62f0c9" delay={.5} opacity={Math.max(.16, 1 - roughness / 108)} />
      {scattered.map((end, index) => <PhotonBeam start={origin} end={end} color="#70d6bd" delay={index * .12} opacity={.22 + roughness / 420} key={index} />)}
      <AngleArc angle={angle} side="left" color="#ffd36b" />
      <AngleArc angle={angle} side="right" color="#62f0c9" />
    </>}
  </SceneFrame>;
}

function MirrorArrow({ position, virtual = false }: { position: Point3; virtual?: boolean }) {
  const color = virtual ? "#69e7ea" : "#ffc563";
  const opacity = virtual ? .32 : 1;
  return <group position={position}>
    <mesh position={[0, .1, 0]} castShadow={!virtual}>
      <cylinderGeometry args={[.42, .42, .18, 28]} />
      <meshStandardMaterial color={color} transparent={virtual} opacity={opacity} emissive={color} emissiveIntensity={virtual ? .25 : .06} depthWrite={!virtual} />
    </mesh>
    <mesh position={[0, 1.05, 0]} castShadow={!virtual}>
      <cylinderGeometry args={[.09, .12, 1.8, 18]} />
      <meshStandardMaterial color={color} transparent={virtual} opacity={opacity} emissive={color} emissiveIntensity={virtual ? .34 : .12} depthWrite={!virtual} />
    </mesh>
    <mesh position={[0, 2.05, 0]} castShadow={!virtual}>
      <coneGeometry args={[.3, .55, 24]} />
      <meshStandardMaterial color={color} transparent={virtual} opacity={opacity} emissive={color} emissiveIntensity={virtual ? .4 : .18} depthWrite={!virtual} />
    </mesh>
    {!virtual && <pointLight position={[0, 2.08, 0]} color="#ffc563" intensity={1.1} distance={2.8} />}
  </group>;
}

function ObserverEye({ position }: { position: Point3 }) {
  return <group position={position}>
    <mesh scale={[1.35, .78, .72]} castShadow>
      <sphereGeometry args={[.3, 28, 20]} />
      <meshStandardMaterial color="#e8ddd0" roughness={.6} />
    </mesh>
    <mesh position={[0, 0, -.205]}>
      <sphereGeometry args={[.13, 22, 18]} />
      <meshStandardMaterial color="#4ed3d0" emissive="#16777c" emissiveIntensity={.65} />
    </mesh>
    <mesh position={[0, 0, -.285]}>
      <sphereGeometry args={[.057, 18, 18]} />
      <meshBasicMaterial color="#07171b" />
    </mesh>
    <mesh position={[0, -.58, .12]} castShadow>
      <cylinderGeometry args={[.34, .48, .72, 24]} />
      <meshStandardMaterial color="#477481" roughness={.75} />
    </mesh>
  </group>;
}

export function PlaneMirrorScene3D({ objectDistance, observerPosition, screenPlaced, interacted, onInteract, onNavigate, onViewChange }: PlaneMirrorSceneProps) {
  const distance = 1.35 + (objectDistance - 90) / 170 * 2.35;
  const observerX = observerPosition / 42;
  const objectTop: Point3 = [0, 2.32, distance];
  const imageTop: Point3 = [0, 2.32, -distance];
  const observerZ = 4.75;
  const pupilPoints: Point3[] = [[observerX - .13, 1.48, observerZ], [observerX + .13, 1.48, observerZ]];
  const reflectionPoints = pupilPoints.map((pupil): Point3 => {
    const t = distance / (observerZ + distance);
    return [t * pupil[0], imageTop[1] + t * (pupil[1] - imageTop[1]), 0];
  });
  const badges = [
    `物距 = 像距 ${objectDistance} 格`,
    "正立 · 等大 · 虚像",
    screenPlaced ? "验证：光屏无清晰像" : "镜后为反向延长线"
  ];

  return <SceneFrame ariaLabel="可旋转缩放的平面镜成像三维实验场景" onInteract={onInteract} onNavigate={onNavigate} onViewChange={onViewChange} badges={badges}>
    <mesh position={[0, -.07, 0]} receiveShadow>
      <boxGeometry args={[8, .12, 8.6]} />
      <meshStandardMaterial color="#102c34" roughness={.88} metalness={.18} />
    </mesh>

    <group>
      <mesh position={[0, 1.55, 0]} renderOrder={2}>
        <planeGeometry args={[6.4, 4.8]} />
        <meshPhysicalMaterial color="#a9d7df" metalness={.84} roughness={.08} transparent opacity={.32} transmission={.18} clearcoat={1} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3.98, 0]}><boxGeometry args={[6.65, .13, .14]} /><meshStandardMaterial color="#9bb3b6" metalness={.85} roughness={.2} /></mesh>
      <mesh position={[0, -.88, 0]}><boxGeometry args={[6.65, .13, .14]} /><meshStandardMaterial color="#9bb3b6" metalness={.85} roughness={.2} /></mesh>
      <mesh position={[-3.27, 1.55, 0]}><boxGeometry args={[.13, 4.98, .14]} /><meshStandardMaterial color="#9bb3b6" metalness={.85} roughness={.2} /></mesh>
      <mesh position={[3.27, 1.55, 0]}><boxGeometry args={[.13, 4.98, .14]} /><meshStandardMaterial color="#9bb3b6" metalness={.85} roughness={.2} /></mesh>
      <Line points={[[-3.12, -.72, .018], [3.12, -.72, .018]]} color="#c8f3f4" lineWidth={1} transparent opacity={.34} />
      <Line points={[[0, -.72, .018], [0, 3.82, .018]]} color="#c8f3f4" lineWidth={1} transparent opacity={.25} dashed dashScale={6} dashSize={.3} gapSize={.2} />
    </group>

    <MirrorArrow position={[0, 0, distance]} />
    <ObserverEye position={[observerX, 1.48, observerZ]} />

    {interacted && <>
      <MirrorArrow position={[0, 0, -distance]} virtual />
      <Line points={[[0, .05, distance], [0, .05, -distance]]} color="#82acb2" lineWidth={1.4} transparent opacity={.55} dashed dashScale={7} dashSize={.3} gapSize={.22} />
      {reflectionPoints.map((reflectionPoint, index) => <group key={index}>
        <PhotonBeam start={objectTop} end={reflectionPoint} color="#ffd267" delay={index * .18} />
        <PhotonBeam start={reflectionPoint} end={pupilPoints[index]} color="#62e8cc" delay={.42 + index * .18} />
        <PhotonBeam start={reflectionPoint} end={imageTop} color="#69dce7" dashed opacity={.52} />
        <mesh position={reflectionPoint}><sphereGeometry args={[.075, 16, 16]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      </group>)}
    </>}

    {screenPlaced && <group position={[0, 1.45, -distance - .08]}>
      <mesh>
        <planeGeometry args={[2.15, 3.45]} />
        <meshPhysicalMaterial color="#d9eef0" transparent opacity={.17} roughness={.42} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -.04]}><boxGeometry args={[2.3, 3.6, .08]} /><meshBasicMaterial color="#8ba8aa" wireframe transparent opacity={.68} /></mesh>
    </group>}
  </SceneFrame>;
}

function CurvedMirrorSurface({ mirror, position }: { mirror: "concave" | "convex"; position: Point3 }) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    const ySegments = 28;
    const zSegments = 24;
    const height = 2.9;
    const width = 3.25;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let yIndex = 0; yIndex <= ySegments; yIndex += 1) {
      const y = -height / 2 + height * yIndex / ySegments;
      for (let zIndex = 0; zIndex <= zSegments; zIndex += 1) {
        const z = -width / 2 + width * zIndex / zSegments;
        const sag = (y * y * .055 + z * z * .075) * (mirror === "concave" ? 1 : -1);
        positions.push(sag, y, z);
      }
    }
    for (let yIndex = 0; yIndex < ySegments; yIndex += 1) {
      for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
        const a = yIndex * (zSegments + 1) + zIndex;
        const b = a + zSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [mirror]);
  const edgePoint = (y: number, z: number): Point3 => {
    const sag = (y * y * .055 + z * z * .075) * (mirror === "concave" ? 1 : -1);
    return [position[0] + sag, position[1] + y, position[2] + z];
  };
    const top = Array.from({ length: 25 }, (_, index) => edgePoint(1.45, -1.625 + index * 3.25 / 24));
    const bottom = Array.from({ length: 25 }, (_, index) => edgePoint(-1.45, -1.625 + index * 3.25 / 24));
    const left = Array.from({ length: 29 }, (_, index) => edgePoint(-1.45 + index * 2.9 / 28, -1.625));
    const right = Array.from({ length: 29 }, (_, index) => edgePoint(-1.45 + index * 2.9 / 28, 1.625));
  return <group>
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <meshPhysicalMaterial color={mirror === "concave" ? "#9ed4dc" : "#b7cbd0"} metalness={.92} roughness={.08} clearcoat={1} side={DoubleSide} />
    </mesh>
    {[top, bottom, left, right].map((points, index) => <Line points={points} color="#ddf6f4" lineWidth={2.1} transparent opacity={.72} key={index} />)}
  </group>;
}

function CurvedSceneArrow({ x, axisY, height, virtual = false, image = false }: { x: number; axisY: number; height: number; virtual?: boolean; image?: boolean }) {
  const color = virtual ? "#70dfe7" : image ? "#ff856f" : "#ffd169";
  const opacity = virtual ? .38 : .92;
  const shaftHeight = Math.max(.12, Math.abs(height));
  const direction = height >= 0 ? 1 : -1;
  return <group>
    <mesh position={[x, axisY + height / 2, 0]}>
      <cylinderGeometry args={[.055, .075, shaftHeight, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.2} transparent={virtual} opacity={opacity} depthWrite={!virtual} />
    </mesh>
    <mesh position={[x, axisY + height, 0]} rotation={[direction < 0 ? Math.PI : 0, 0, 0]}>
      <coneGeometry args={[.19, .4, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.28} transparent={virtual} opacity={opacity} depthWrite={!virtual} />
    </mesh>
    <mesh position={[x, axisY, 0]}><boxGeometry args={[.42, .08, .42]} /><meshStandardMaterial color={color} transparent={virtual} opacity={opacity} /></mesh>
  </group>;
}

function rayAwayFrom(point: Point3, target: Point3, length = 5.2): Point3 {
  const dx = point[0] - target[0];
  const dy = point[1] - target[1];
  const dz = point[2] - target[2];
  const magnitude = Math.hypot(dx, dy, dz) || 1;
  return [point[0] + dx / magnitude * length, point[1] + dy / magnitude * length, point[2] + dz / magnitude * length];
}

export function CurvedMirrorScene3D({ mirror, objectDistance, imageDistance, magnification, real, atFocus, nature, interacted, onInteract, onNavigate, onViewChange }: CurvedMirrorSceneProps) {
  const mirrorX = 2.75;
  const axisY = 1.45;
  const scale = .0125;
  const focalLength = 1.5;
  const objectX = mirrorX - objectDistance * scale;
  const objectHeight = 1.2;
  const rawImageX = Number.isFinite(imageDistance) ? mirrorX - imageDistance * scale : -4.7;
  const imageX = Math.max(-4.7, Math.min(4.8, rawImageX));
  const imageHeight = Number.isFinite(magnification) ? Math.sign(magnification || 1) * Math.min(1.35, Math.max(.25, Math.abs(magnification) * objectHeight)) : 0;
  const objectTop: Point3 = [objectX, axisY + objectHeight, 0];
  const imageTop: Point3 = [imageX, axisY + imageHeight, 0];
  const mirrorPoints: Point3[] = [[mirrorX + .075, axisY + 1, -.42], [mirrorX + .035, axisY + .22, .42]];
  const focusX = mirror === "concave" ? mirrorX - focalLength : mirrorX + focalLength;
  const centerX = mirror === "concave" ? mirrorX - focalLength * 2 : mirrorX + focalLength * 2;
  const reflectedEnds = mirrorPoints.map((point): Point3 => {
    if (atFocus) return [point[0] - 5.2, point[1] - 5.2 * objectHeight / focalLength, point[2]];
    return real ? imageTop : rayAwayFrom(point, imageTop);
  });
  const badges = [mirror === "concave" ? "凹面镜 · 会聚镜" : "凸面镜 · 发散镜", `物距 ${objectDistance} 格`, interacted ? nature : "移动物体后显示成像"];

  return <SceneFrame ariaLabel="可旋转缩放的凹面镜和凸面镜三维成像场景" onInteract={onInteract} onNavigate={onNavigate} onViewChange={onViewChange} badges={badges}>
    <mesh position={[0, -.08, 0]} receiveShadow><boxGeometry args={[10.5, .14, 6.4]} /><meshStandardMaterial color="#102b33" roughness={.88} metalness={.16} /></mesh>
    <Line points={[[-5.2, axisY, 0], [5.2, axisY, 0]]} color="#71939a" lineWidth={1.4} dashed dashScale={7} dashSize={.36} gapSize={.24} />
    <CurvedMirrorSurface mirror={mirror} position={[mirrorX, axisY, 0]} />
    <CurvedSceneArrow x={objectX} axisY={axisY} height={objectHeight} />
    <mesh position={[focusX, axisY, 0]}><sphereGeometry args={[.105, 18, 18]} /><meshBasicMaterial color="#ffd169" toneMapped={false} /></mesh>
    <mesh position={[centerX, axisY, 0]}><sphereGeometry args={[.075, 18, 18]} /><meshBasicMaterial color="#86aab0" toneMapped={false} /></mesh>
    <Line points={[[focusX, axisY - .28, 0], [focusX, axisY + .28, 0]]} color="#ffd169" lineWidth={1.5} />
    <Line points={[[centerX, axisY - .22, 0], [centerX, axisY + .22, 0]]} color="#86aab0" lineWidth={1.2} />

    {interacted && <>
      {!atFocus && <CurvedSceneArrow x={imageX} axisY={axisY} height={imageHeight} image virtual={!real} />}
      {mirrorPoints.map((point, index) => <group key={index}>
        <PhotonBeam start={objectTop} end={point} color="#ffd169" delay={index * .2} />
        <PhotonBeam start={point} end={reflectedEnds[index]} color="#61e5c9" delay={.42 + index * .2} />
        {!real && !atFocus && <PhotonBeam start={point} end={imageTop} color="#69dce7" dashed opacity={.54} />}
        <mesh position={point}><sphereGeometry args={[.07, 16, 16]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      </group>)}
      {mirror === "convex" && <Line points={[[mirrorX, axisY, 0], [focusX, axisY, 0]]} color="#69dce7" lineWidth={1.2} dashed dashScale={7} dashSize={.3} gapSize={.22} transparent opacity={.4} />}
    </>}
  </SceneFrame>;
}

function GlassLens({ x, axisY, kind = "convex", size = 1 }: { x: number; axisY: number; kind?: "convex" | "concave"; size?: number }) {
  return <group position={[x, axisY, 0]}>
    {kind === "convex" ? <mesh scale={[.16, 1.18 * size, 1.18 * size]} castShadow>
      <sphereGeometry args={[1, 40, 28]} />
      <meshPhysicalMaterial color="#76dbea" transparent opacity={.36} transmission={.72} roughness={.08} metalness={.08} thickness={.35} side={DoubleSide} depthWrite={false} />
    </mesh> : <>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.02 * size, 1.02 * size, .12, 40, 1, true]} />
        <meshPhysicalMaterial color="#76dbea" transparent opacity={.3} transmission={.7} roughness={.08} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh scale={[.18, .72 * size, .72 * size]}><sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color="#06171f" transparent opacity={.78} depthWrite={false} /></mesh>
    </>}
    <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[1.02 * size, .035, 12, 48]} /><meshStandardMaterial color="#b9f3f1" emissive="#4eaeb3" emissiveIntensity={.35} /></mesh>
  </group>;
}

function LensScreen({ x, axisY, active = false, retina = false }: { x: number; axisY: number; active?: boolean; retina?: boolean }) {
  return <group position={[x, axisY, 0]}>
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[2.45, 2.65]} />
      <meshPhysicalMaterial color={active ? "#ffe8a4" : retina ? "#d38a69" : "#d6e4e2"} transparent opacity={active ? .48 : .2} roughness={.48} side={DoubleSide} depthWrite={false} />
    </mesh>
    <mesh><boxGeometry args={[.08, 2.75, 2.55]} /><meshBasicMaterial color={active ? "#eac367" : "#769095"} wireframe transparent opacity={.66} /></mesh>
  </group>;
}

export function LensSystemScene3D({ apparatus, objectDistance, focalLength, imageDistance, magnification, real, nature, interacted, screenDistance, secondFocalLength, correctionLens = "none", correctionEffective = false, onInteract, onNavigate, onViewChange }: LensSystemSceneProps) {
  const axisY = 1.35;
  const focalScale = 1.42;
  const ratio = objectDistance / Math.max(.01, focalLength);
  const objectX = -Math.min(4.65, Math.max(.72, ratio * focalScale));
  const finiteImage = Number.isFinite(imageDistance);
  const imageRatio = finiteImage ? imageDistance / Math.max(.01, focalLength) : 4.8;
  const imageX = Math.max(-4.75, Math.min(4.75, imageRatio * focalScale));
  const objectHeight = apparatus === "microscope" ? .62 : 1.05;
  const imageHeight = Number.isFinite(magnification) ? Math.sign(magnification || 1) * Math.min(1.45, Math.max(.24, Math.abs(magnification) * objectHeight)) : 0;
  const objectTop: Point3 = [objectX, axisY + objectHeight, 0];
  const imageTop: Point3 = [imageX, axisY + imageHeight, 0];
  const lensPoints: Point3[] = [[0, axisY + .92, -.32], [0, axisY + .2, .32]];
  const focusOutputSlope = -objectHeight / Math.max(.01, -objectX);
  const rayEnds = lensPoints.map((point): Point3 => {
    if (!finiteImage) return [5, point[1] + focusOutputSlope * (5 - point[0]), point[2]];
    return real ? imageTop : rayAwayFrom(point, imageTop);
  });
  const normalizedScreenX = screenDistance == null ? 0 : Math.max(.75, Math.min(4.75, screenDistance / Math.max(.01, focalLength) * focalScale));
  const screenFocused = real && finiteImage && screenDistance != null && Math.abs(screenDistance - imageDistance) <= Math.max(.3, focalLength * .04);
  const secondLensX = apparatus === "telescope" || apparatus === "microscope" ? 2.25 : 0;
  const correctionImageX = Math.max(2.35, Math.min(4.5, 3.34 + (imageDistance - 17) * .15));
  const apparatusName = apparatus === "magnifier" ? "放大镜" : apparatus === "bench" ? "自由光具座" : apparatus === "camera" ? "照相机" : apparatus === "eye" ? "人的眼睛" : apparatus === "correction" ? "视力矫正" : apparatus === "telescope" ? "望远镜" : "显微镜";
  const displayNature = apparatus === "correction" ? correctionLens === "none" ? "尚未佩戴矫正镜片" : correctionEffective ? "像点回到视网膜" : "像点仍未落在视网膜" : nature;
  const badges = [apparatusName, `f = ${focalLength.toFixed(1)}`, interacted ? displayNature : "调节后显示光路"];

  return <SceneFrame ariaLabel={`${apparatusName}可旋转缩放三维光路场景`} onInteract={onInteract} onNavigate={onNavigate} onViewChange={onViewChange} badges={badges}>
    <mesh position={[0, -.08, 0]} receiveShadow><boxGeometry args={[11, .14, 6.4]} /><meshStandardMaterial color="#102b33" roughness={.9} metalness={.14} /></mesh>
    <Line points={[[ -5.25, axisY, 0], [5.25, axisY, 0]]} color="#71939a" lineWidth={1.35} dashed dashScale={7} dashSize={.36} gapSize={.24} />
    <Line points={[[-focalScale, axisY - .2, 0], [-focalScale, axisY + .2, 0]]} color="#ffd169" lineWidth={1.4} />
    <Line points={[[focalScale, axisY - .2, 0], [focalScale, axisY + .2, 0]]} color="#ffd169" lineWidth={1.4} />
    <mesh position={[-focalScale, axisY, 0]}><sphereGeometry args={[.075, 16, 16]} /><meshBasicMaterial color="#ffd169" /></mesh>
    <mesh position={[focalScale, axisY, 0]}><sphereGeometry args={[.075, 16, 16]} /><meshBasicMaterial color="#ffd169" /></mesh>

    {apparatus !== "correction" && <GlassLens x={0} axisY={axisY} />}
    {apparatus === "correction" && <>
      <GlassLens x={.55} axisY={axisY} size={.86} />
      {correctionLens !== "none" && <GlassLens x={-1.35} axisY={axisY} kind={correctionLens} size={.82} />}
    </>}
    {(apparatus === "telescope" || apparatus === "microscope") && <GlassLens x={secondLensX} axisY={axisY} size={.82 + Math.min(.32, (secondFocalLength ?? 10) / 70)} />}
    <CurvedSceneArrow x={objectX} axisY={axisY} height={objectHeight} />

    {(apparatus === "bench" || apparatus === "camera") && screenDistance != null && <LensScreen x={normalizedScreenX} axisY={axisY} active={interacted && screenFocused} />}
    {apparatus === "eye" && <>
      <mesh position={[.7, axisY, 0]} scale={[.86, 1.32, 1.32]}><sphereGeometry args={[1, 36, 28]} /><meshPhysicalMaterial color="#8eb8bd" transparent opacity={.13} transmission={.65} roughness={.24} side={DoubleSide} depthWrite={false} /></mesh>
      <LensScreen x={normalizedScreenX} axisY={axisY} active={interacted && screenFocused} retina />
    </>}
    {apparatus === "correction" && <>
      <mesh position={[2.4, axisY, 0]} scale={[1.32, 1.38, 1.38]}><sphereGeometry args={[1, 36, 28]} /><meshPhysicalMaterial color="#8eb8bd" transparent opacity={.13} transmission={.62} roughness={.25} side={DoubleSide} depthWrite={false} /></mesh>
      <LensScreen x={3.34} axisY={axisY} active={interacted && correctionEffective} retina />
    </>}
    {apparatus === "camera" && <group position={[1.55, axisY, 0]}><mesh><boxGeometry args={[3.35, 3, 3.4]} /><meshStandardMaterial color="#263e47" transparent opacity={.17} wireframe /></mesh></group>}

    {interacted && (apparatus === "telescope" || apparatus === "microscope") ? <>
      {lensPoints.map((point, index) => {
        const middle: Point3 = [secondLensX, axisY + (index === 0 ? .45 : -.15), index === 0 ? -.22 : .22];
        const exit: Point3 = [5, axisY + (index === 0 ? .2 : -.04), index === 0 ? -.1 : .1];
        return <group key={index}><PhotonBeam start={objectTop} end={point} color="#ffd169" delay={index * .2} /><PhotonBeam start={point} end={middle} color="#61e5c9" delay={.35 + index * .2} /><PhotonBeam start={middle} end={exit} color="#67c9ff" delay={.7 + index * .2} /></group>;
      })}
      <CurvedSceneArrow x={1.12} axisY={axisY} height={apparatus === "microscope" ? -1.05 : -.65} image />
    </> : interacted && <>
      {!apparatus.startsWith("correction") && finiteImage && <CurvedSceneArrow x={imageX} axisY={axisY} height={imageHeight} image virtual={!real} />}
      {lensPoints.map((point, index) => <group key={index}>
        <PhotonBeam start={objectTop} end={apparatus === "correction" && correctionLens !== "none" ? [-1.35, point[1], point[2]] : point} color="#ffd169" delay={index * .2} />
        {apparatus === "correction" && correctionLens !== "none" && <PhotonBeam start={[-1.35, point[1], point[2]]} end={[.55, point[1] + (correctionLens === "concave" ? -.12 : .12), point[2]]} color="#61e5c9" delay={.25 + index * .2} />}
        <PhotonBeam start={apparatus === "correction" ? [.55, point[1] + (correctionLens === "concave" ? -.12 : .12), point[2]] : point} end={apparatus === "correction" ? [correctionImageX, axisY, 0] : rayEnds[index]} color="#61e5c9" delay={.45 + index * .2} />
        {!real && finiteImage && apparatus !== "correction" && <PhotonBeam start={point} end={imageTop} color="#69dce7" dashed opacity={.52} />}
      </group>)}
    </>}
  </SceneFrame>;
}

function mediumColor(name: string) {
  if (name === "水") return "#1676a8";
  if (name === "玻璃") return "#54b9c6";
  return "#17313b";
}

function mediumOpacity(name: string) {
  if (name === "水") return .2;
  if (name === "玻璃") return .15;
  return .035;
}

export function RefractionScene3D({ angle, refractionAngle, totalInternalReflection, topMedium, bottomMedium, interacted, onInteract, onNavigate, onViewChange }: RefractionSceneProps) {
  const incidenceRadians = angle * Math.PI / 180;
  const resultRadians = (refractionAngle ?? angle) * Math.PI / 180;
  const length = 4.1;
  const origin: Point3 = [0, 0, 0];
  const incident: Point3 = [-Math.sin(incidenceRadians) * length, Math.cos(incidenceRadians) * length, 0];
  const refracted: Point3 = [Math.sin(resultRadians) * length, -Math.cos(resultRadians) * length, 0];
  const reflected: Point3 = [Math.sin(incidenceRadians) * length, Math.cos(incidenceRadians) * length, 0];

  return <SceneFrame ariaLabel="可旋转缩放的光折射三维实验场景" onInteract={onInteract} onNavigate={onNavigate} onViewChange={onViewChange} badges={[`${topMedium} → ${bottomMedium}`, `入射角 ${angle.toFixed(0)}°`, totalInternalReflection ? "发生全反射" : `折射角 ${refractionAngle?.toFixed(1)}°`]}>
    <MeasurementPlane />
    <mesh position={[0, 1.55, 0]}>
      <boxGeometry args={[8.6, 3.1, 6.2]} />
      <meshPhysicalMaterial color={mediumColor(topMedium)} transparent opacity={mediumOpacity(topMedium)} roughness={.18} transmission={topMedium === "空气" ? .2 : .45} depthWrite={false} side={DoubleSide} />
    </mesh>
    <mesh position={[0, -1.55, 0]}>
      <boxGeometry args={[8.6, 3.1, 6.2]} />
      <meshPhysicalMaterial color={mediumColor(bottomMedium)} transparent opacity={mediumOpacity(bottomMedium)} roughness={.18} transmission={bottomMedium === "空气" ? .2 : .45} depthWrite={false} side={DoubleSide} />
    </mesh>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[8.65, .055, 6.25]} />
      <meshStandardMaterial color="#8db9c1" transparent opacity={.38} />
    </mesh>
    <Line points={[[0, 4.15, 0], [0, -4.15, 0]]} color="#e2ecee" lineWidth={1.5} dashed dashScale={6} dashSize={.35} gapSize={.22} />
    <mesh position={origin}><sphereGeometry args={[.11, 18, 18]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
    {interacted && <>
      <PhotonBeam start={incident} end={origin} color="#ffd36b" delay={0} />
      {totalInternalReflection ? <PhotonBeam start={origin} end={reflected} color="#62f0c9" delay={.5} /> : <PhotonBeam start={origin} end={refracted} color="#5fc8ff" delay={.5} />}
      <AngleArc angle={angle} side="left" color="#ffd36b" />
      {!totalInternalReflection && refractionAngle != null && <AngleArc angle={refractionAngle} side="right" color="#5fc8ff" lower />}
      {totalInternalReflection && <AngleArc angle={angle} side="right" color="#62f0c9" />}
    </>}
  </SceneFrame>;
}
