import { useEffect, useRef } from 'react';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { PENDULUM_ANGLE, pendulumAmplitude } from './PendulumGeometry';

export interface PendulumInstrumentProps {
  parameters: Record<string, number>;
  simulation: HighSchoolSimulation;
  onChange?: (patch: Record<string, number>) => void;
}
export function usePendulumControls(props: PendulumInstrumentProps) {
  const current = useRef(props); current.current = props;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function setAngle(value: number) {
    if (!mounted.current || !current.current.onChange || !Number.isFinite(value)) return;
    const angle = pendulumAmplitude(value);
    if (angle !== current.current.parameters.amplitudeDegrees) current.current.onChange({ amplitudeDegrees: angle });
  }
  return { setAngle, stepAngle: (step: number) => setAngle(current.current.parameters.amplitudeDegrees + step), canChange: () => mounted.current && Boolean(current.current.onChange) };
}
export function PendulumControlBar({ angle, setAngle, stepAngle, disabled = false }: { angle: number; setAngle: (value: number) => void; stepAngle: (step: number) => void; disabled?: boolean }) {
  return <div className="hs-pendulum-controlbar" role="group" aria-label="调整单摆释放角">
    <span>释放角 <b>{angle}°</b></span>
    <button type="button" disabled={disabled || angle <= PENDULUM_ANGLE.min} onClick={() => stepAngle(-1)} aria-label="释放角减小1度">−1°</button>
    <button type="button" disabled={disabled || angle >= PENDULUM_ANGLE.max} onClick={() => stepAngle(1)} aria-label="释放角增大1度">+1°</button>
    <button type="button" disabled={disabled} aria-pressed={angle === 5} onClick={() => setAngle(5)}>5° 小角观察</button>
    <button type="button" disabled={disabled} aria-pressed={angle === 45} onClick={() => setAngle(45)}>45° 大角对照</button>
  </div>;
}

/** A regular document control avoids clipping or moving with the 3D camera on phones. */
export function PendulumTouchControls(props: PendulumInstrumentProps) {
  const controls = usePendulumControls(props);
  return <div className="hs-pendulum-touch-controls">
    <PendulumControlBar angle={props.parameters.amplitudeDegrees} setAngle={controls.setAngle} stepAngle={controls.stepAngle} disabled={!props.onChange} />
    <p>改角度回到释放点并暂停 · 周期数由你计数</p>
  </div>;
}
