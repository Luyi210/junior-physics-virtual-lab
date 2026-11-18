import { useEffect, useRef } from 'react';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import type { ExpandedExperimentId } from './expandedGeometry';

export interface ExpandedSceneProps {
  experimentId: ExpandedExperimentId;
  parameters: Record<string, number>;
  simulation: HighSchoolSimulation;
  onChange?: (patch: Record<string, number>) => void;
}

export function useExpandedSceneControls(props: ExpandedSceneProps): ExpandedSceneProps {
  const mounted = useRef(false);
  const current = useRef(props); current.current = props;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return { ...props, onChange: props.onChange ? patch => {
    if (!mounted.current || current.current.experimentId !== props.experimentId || !current.current.onChange) return;
    if (Object.entries(patch).some(([key, value]) => !Object.hasOwn(current.current.parameters, key) || !Number.isFinite(value))) return;
    current.current.onChange(patch);
  } : undefined };
}
