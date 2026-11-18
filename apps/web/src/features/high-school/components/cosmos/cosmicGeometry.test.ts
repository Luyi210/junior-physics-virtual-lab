import { describe, expect, it } from 'vitest';
import { COSMIC_CLOUD, COSMIC_RINGS, COSMIC_WAVE_FREQUENCY, COSMIC_WAVE_NUMBER, DEFAULT_COSMIC_VIEW, cosmicBackingSize, cosmicOrbitPoint, cosmicPointerView, cosmicRandom, cosmicRingSegments, cosmicViewDegrees, cosmicWaveAmplitude, projectCosmicPoint, rotateCosmicPoint } from './cosmicGeometry';
import { paintCosmicObservatory } from './cosmicPainter';
describe('cosmic illustration geometry',()=>{
  it('rotates without changing lengths and gives near objects stronger perspective',()=>{
    const p={x:1.3,y:-.7,z:.6},r=rotateCosmicPoint(p,{yaw:.8,pitch:-.4});expect(Math.hypot(r.x,r.y,r.z)).toBeCloseTo(Math.hypot(p.x,p.y,p.z));
    expect(projectCosmicPoint({x:1,y:0,z:-2},{yaw:0,pitch:0}).scale).toBeGreaterThan(projectCosmicPoint({x:1,y:0,z:2},{yaw:0,pitch:0}).scale);
    for(let angle=0;angle<Math.PI*2;angle+=.1)expect(Math.hypot(...Object.values(cosmicOrbitPoint(angle,1.83,.7,.9)))).toBeCloseTo(1.83);
    const satellite=projectCosmicPoint(cosmicOrbitPoint(5.55),DEFAULT_COSMIC_VIEW);expect(satellite.depth).toBeLessThan(0);expect(Math.hypot(satellite.x-325,satellite.y-209)).toBeGreaterThan(133);
  });
  it('keeps drag viewing bounded and uses deterministic two-lobed density, not an electron path',()=>{
    expect(cosmicPointerView(DEFAULT_COSMIC_VIEW,100000,-100000,288)).toEqual({yaw:1.25,pitch:-.62});expect(cosmicPointerView(DEFAULT_COSMIC_VIEW,1,1,NaN)).toEqual(DEFAULT_COSMIC_VIEW);
    const a=cosmicRandom(42),b=cosmicRandom(42);expect(Array.from({length:20},()=>a())).toEqual(Array.from({length:20},()=>b()));
    expect(COSMIC_CLOUD.every(p=>Math.abs(p.y)>=.2&&[p.x,p.y,p.z,p.weight].every(Number.isFinite))).toBe(true);expect(COSMIC_CLOUD.filter(p=>p.lobe===1)).toHaveLength(750);
  });
  it('forms constructive and destructive wave interference from the same two source phases',()=>{
    const time=COSMIC_WAVE_NUMBER*.66/COSMIC_WAVE_FREQUENCY;expect(cosmicWaveAmplitude(0,0,time)).toBeCloseTo(1);
    expect(cosmicWaveAmplitude(Math.PI/(2*COSMIC_WAVE_NUMBER),0,time)).toBeCloseTo(0,12);
    for(const x of [-1.5,-.3,0,.6,1.4])expect(cosmicWaveAmplitude(x,.5,2)).toBeCloseTo(cosmicWaveAmplitude(-x,.5,2));
  });
  it('paints all three modes using finite primitives even at drag bounds and long elapsed time',()=>{
    let paths=0;const finite=(...args:number[])=>{expect(args.every(Number.isFinite)).toBe(true);paths+=1;};const gradient={addColorStop:()=>{}};
    const ctx={clearRect:finite,fillRect:finite,createRadialGradient:(...args:number[])=>{finite(...args);return gradient;},beginPath(){},moveTo:finite,lineTo:finite,arc:finite,fill(){},stroke(){},save(){},restore(){},clip(){}} as unknown as CanvasRenderingContext2D;
    for(const mode of ['orbit','waves','quantum'] as const)for(const view of [DEFAULT_COSMIC_VIEW,{yaw:1.25,pitch:-.62}])paintCosmicObservatory(ctx,mode,view,12345);
    expect(paths).toBeGreaterThan(10000);
  });
  it('shares front/back orbit geometry across fallback and canvas while exposing only real camera angles',()=>{
    for(const ring of COSMIC_RINGS)for(const front of [true,false]){
      const segments=cosmicRingSegments(DEFAULT_COSMIC_VIEW,ring,front);expect(segments.length).toBeGreaterThan(0);
      expect(segments.flat().every(point=>(point.depth<0)===front)).toBe(true);
    }
    const angles=cosmicViewDegrees({yaw:Math.PI/6,pitch:-Math.PI/12});expect(angles.yaw).toBeCloseTo(30);expect(angles.pitch).toBeCloseTo(-15);
    expect(cosmicBackingSize(1600,3)).toEqual({width:1600,height:1034});expect(cosmicBackingSize(272,3)).toEqual({width:408,height:264});expect(cosmicBackingSize(NaN,NaN)).toEqual({width:650,height:420});
  });
});
