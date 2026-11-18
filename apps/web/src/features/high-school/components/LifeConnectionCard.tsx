import { Lightbulb } from 'lucide-react';
import type { HighSchoolExperimentId } from '@physics-lab/physics';
import { getHighSchoolLifeConnection } from '@physics-lab/knowledge/high-school';
import './LifeConnectionCard.css';

export function LifeConnectionCard({ experimentId }: { experimentId: HighSchoolExperimentId }) {
  const connection = getHighSchoolLifeConnection(experimentId);
  if (!connection) return null;
  return <section className="hs-life-connection" aria-labelledby="hs-life-connection-title">
    <header><span><Lightbulb size={17} aria-hidden="true" />生活中的物理</span><h2 id="hs-life-connection-title">从身边现象进入实验</h2></header>
    <div className="hs-life-connection-grid">
      <div><h3>你可能见过</h3><p>{connection.scene}</p></div>
      <div><h3>在实验里试一试</h3><p>{connection.connection}</p></div>
      <div><h3>类比到这里为止</h3><p>{connection.boundary}</p></div>
    </div>
  </section>;
}
