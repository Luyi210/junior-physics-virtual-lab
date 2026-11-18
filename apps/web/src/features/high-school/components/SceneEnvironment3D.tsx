import { Grid } from '@react-three/drei';

/** The stage top stays at the original ground height; all added depth is below it. */
export function SceneEnvironment3D() {
  return <>
    <color attach="background" args={['#070e1b']} />
    <fog attach="fog" args={['#070e1b', 28, 60]} />
    <ambientLight intensity={.22} color="#dce8f2" />
    <hemisphereLight args={['#d8edff', '#263242', .9]} />
    <directionalLight
      position={[4.5, 8, 5]} intensity={3.2} color="#fff1dc" castShadow
      shadow-mapSize={[1024, 1024]} shadow-bias={-.0001} shadow-normalBias={.015}
      shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={10} shadow-camera-bottom={-10}
      shadow-camera-near={.5} shadow-camera-far={35}
    />
    <directionalLight position={[-5, 3, 4]} intensity={.85} color="#9edbea" />
    <directionalLight position={[-4, 6, -5]} intensity={2} color="#b5d6ff" />

    {/* A lower room floor receives the stage shadow, without lifting any instrument. */}
    <mesh name="laboratory-floor" rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.97, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#091421" roughness={.9} metalness={.03} />
    </mesh>

    {/* Single solid top replaces the old plane, so the two cannot z-fight. */}
    <mesh name="instrument-stage" position={[0, -1.65, 0]} castShadow receiveShadow>
      <boxGeometry args={[13, .3, 10]} />
      <meshStandardMaterial color="#1b3041" roughness={.68} metalness={.18} />
    </mesh>
    <mesh name="stage-recess" position={[0, -1.88, 0]} castShadow receiveShadow>
      <boxGeometry args={[12.7, .16, 9.7]} />
      <meshStandardMaterial color="#09131e" roughness={.46} metalness={.3} />
    </mesh>
    {/* Quiet edge inlays show perspective; they are not instrument scales or data. */}
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[0, -1.64, side * 5.006]}>
        <boxGeometry args={[12.7, .025, .012]} />
        <meshStandardMaterial color="#5f9aa8" emissive="#376775" emissiveIntensity={.22} roughness={.36} metalness={.4} />
      </mesh>
      <mesh position={[side * 6.506, -1.64, 0]}>
        <boxGeometry args={[.012, .025, 9.7]} />
        <meshStandardMaterial color="#b39a72" emissive="#69512f" emissiveIntensity={.12} roughness={.4} metalness={.45} />
      </mesh>
    </group>)}
    <Grid
      position={[0, -1.494, 0]} args={[12.9, 9.9]}
      cellSize={.5} cellThickness={.3} cellColor="#365265"
      sectionSize={2.5} sectionThickness={.6} sectionColor="#587b8e"
      fadeDistance={16} fadeStrength={1.5}
    />
  </>;
}
