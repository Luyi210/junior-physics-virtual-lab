import { MechanicsApparatus3D } from './MechanicsApparatus3D';
import { ElectricApparatus3D } from './ElectricApparatus3D';
import { MagnetismApparatus3D } from './MagnetismApparatus3D';
import { OpticsThermalApparatus3D } from './OpticsThermalApparatus3D';
import { useExpandedSceneControls, type ExpandedSceneProps } from './expandedSceneTypes';

export function ExpandedApparatus3D(input: ExpandedSceneProps) {
  const props = useExpandedSceneControls(input);
  switch (props.experimentId) {
    case 'centripetal-force': case 'free-fall': case 'momentum-conservation': return <MechanicsApparatus3D {...props} />;
    case 'precision-length': case 'resistivity': case 'multimeter': case 'sensor-control': return <ElectricApparatus3D {...props} />;
    case 'induced-current': case 'transformer-ratio': case 'charged-particle-field': return <MagnetismApparatus3D {...props} />;
    case 'refractive-index': case 'oil-film': case 'gas-pressure-volume': case 'photoelectric-effect': return <OpticsThermalApparatus3D {...props} />;
  }
}
