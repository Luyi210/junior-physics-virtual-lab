import { MechanicsDiagram } from './MechanicsDiagrams';
import { ElectricDiagram } from './ElectricDiagrams';
import { MagnetismDiagram } from './MagnetismDiagrams';
import { OpticsThermalDiagram } from './OpticsThermalDiagrams';
import { useExpandedSceneControls, type ExpandedSceneProps } from './expandedSceneTypes';

export function ExpandedDiagram2D(input: ExpandedSceneProps) {
  const props = useExpandedSceneControls(input);
  switch (props.experimentId) {
    case 'centripetal-force': case 'free-fall': case 'momentum-conservation': return <MechanicsDiagram {...props} />;
    case 'precision-length': case 'resistivity': case 'multimeter': case 'sensor-control': return <ElectricDiagram {...props} />;
    case 'induced-current': case 'transformer-ratio': case 'charged-particle-field': return <MagnetismDiagram {...props} />;
    case 'refractive-index': case 'oil-film': case 'gas-pressure-volume': case 'photoelectric-effect': return <OpticsThermalDiagram {...props} />;
  }
}
