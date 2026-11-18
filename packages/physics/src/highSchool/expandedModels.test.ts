import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOL_EXPERIMENTS, defaultHighSchoolParameters, validatedHighSchoolParameters } from './catalog';
import { EXPANDED_HIGH_SCHOOL_EXPERIMENTS } from './expansionCatalog';
import { simulateHighSchoolExperiment } from './simulation';
import * as model from './expandedModels';

describe('expanded model finite and catalog contract', () => {
  for (const definition of EXPANDED_HIGH_SCHOOL_EXPERIMENTS) {
    it(`${definition.id}: defaults, each min/max and every discrete choice remain finite with usable graphs`, () => {
      const defaults = defaultHighSchoolParameters(definition.id);
      const variants = [defaults, ...definition.parameters.flatMap(p => [p.min,p.max,...(p.choices?.map(c=>c.value) ?? [])].map(value=>({...defaults,[p.key]:value})))];
      for (const parameters of variants) {
        const initial = simulateHighSchoolExperiment(definition.id,parameters,0);
        for (const time of [0,initial.durationSeconds/2,initial.durationSeconds,initial.durationSeconds+100]) {
          const result = simulateHighSchoolExperiment(definition.id,parameters,time);
          expect(Object.values(result.state).every(Number.isFinite)).toBe(true);
          expect(result.metrics.every(m=>Number.isFinite(m.value))).toBe(true);
          expect(result.series.length).toBeGreaterThan(0);
          for (const series of result.series) {
            expect(series.points.length).toBeGreaterThan(1);
            expect(series.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
            expect(Number.isFinite(result.state[series.key])).toBe(true);
            expect(Number.isFinite(result.state[series.xKey])).toBe(true);
          }
          expect(result.state.time).toBeLessThanOrEqual(result.durationSeconds);
        }
      }
    });
  }
  it('rejects fractional enums/counts, unknown keys and nonfinite inputs without quantizing old continuous inputs', () => {
    expect(()=>validatedHighSchoolParameters('multimeter',{functionMode:.5})).toThrow();
    expect(()=>validatedHighSchoolParameters('oil-film',{usedDrops:1.5})).toThrow();
    expect(()=>validatedHighSchoolParameters('induced-current',{turns:1.5})).toThrow();
    expect(()=>validatedHighSchoolParameters('transformer-ratio',{primaryTurns:100.5})).toThrow();
    expect(()=>validatedHighSchoolParameters('free-fall',{gravity:NaN})).toThrow();
    expect(()=>validatedHighSchoolParameters('free-fall',{unknown:1})).toThrow();
    expect(validatedHighSchoolParameters('spring-force',{loadMassGrams:13.234}).loadMassGrams).toBe(13.234);
    expect(HIGH_SCHOOL_EXPERIMENTS).toHaveLength(24);
  });
});

describe('mechanics actual evolution', () => {
  it('centripetal acceleration is inward, speed and radius are conserved, reversing omega reverses rotation', () => {
    const p={mass:.2,radius:.5,angularSpeed:2}, s=model.calculateCentripetalForce(p,.3), negative=model.calculateCentripetalForce({...p,angularSpeed:-2},.3);
    expect(s.force).toBeCloseTo(.4,12); expect(Math.hypot(s.x!,s.y!)).toBeCloseTo(.5,12);
    expect(Math.hypot(s.vx!,s.vy!)).toBeCloseTo(1,12); expect(s.forceX!*s.x!+s.forceY!*s.y!).toBeLessThan(0);
    expect(negative.x).toBeCloseTo(s.x!,12); expect(negative.y).toBeCloseTo(-s.y!,12);
    const still=model.calculateCentripetalForce({...p,angularSpeed:0},8); expect(still.force).toBe(0); expect(still.periodDefined).toBe(0);
  });
  it('equal-mass head-on collision exchanges velocity only at the actual encounter',()=>{
    const p={mass1:.5,mass2:.5,velocity1:1,velocity2:-1,separation:1,restitution:1};
    const before=model.calculateMomentumConservation(p,.49), exact=model.calculateMomentumConservation(p,.5), after=model.calculateMomentumConservation(p,1);
    expect(before.velocity1).toBe(1);expect(before.collided).toBe(0);expect(exact.x1).toBeCloseTo(exact.x2!,12);
    expect(after.velocity1).toBe(-1);expect(after.velocity2).toBe(1);expect(after.energyLoss).toBeCloseTo(0,12);
  });
  it('inelastic unequal mass collision conserves momentum and loses the predicted relative energy',()=>{
    const p={mass1:.3,mass2:.7,velocity1:2,velocity2:-1,separation:.6,restitution:.4};
    const before=model.calculateMomentumConservation(p,0), after=model.calculateMomentumConservation(p,2);
    expect(after.totalMomentum).toBeCloseTo(before.totalMomentum!,12);
    expect(after.velocity2!-after.velocity1!).toBeCloseTo(.4*3,12);
    expect(after.energyLoss).toBeCloseTo(.5*(.3*.7/1)*(1-.4**2)*3**2,12);
    const stuck=model.calculateMomentumConservation({...p,restitution:0},2);expect(stuck.velocity1).toBe(stuck.velocity2);
  });
  it('receding, equal-speed and beyond-window trajectories do not invent a collision; chasing can collide',()=>{
    for(const p of ([{velocity1:-1,velocity2:1},{velocity1:1,velocity2:1},{velocity1:1,velocity2:.99,separation:3}] as Record<string,number>[])){
      const s=model.calculateMomentumConservation(p,6);expect(s.collided).toBe(0);expect(s.collisionWithinWindow).toBe(0);expect(s.velocity1).toBe(p.velocity1);
    }
    expect(model.calculateMomentumConservation({velocity1:2,velocity2:1,separation:1},1).collided).toBe(1);
  });
  it('unrepresentably remote collision has an explicit undefined-time flag, without inventing a zero-time collision',()=>{
    const p={velocity1:1e-320,velocity2:0,separation:1};
    const s=model.calculateMomentumConservation(p,6);
    expect(s.collisionPredicted).toBe(1);expect(s.collisionWithinWindow).toBe(0);expect(s.collided).toBe(0);expect(s.collisionTimeDefined).toBe(0);expect(s.collisionTime).toBe(0);
    expect(Object.values(s).every(Number.isFinite)).toBe(true);
    const metrics=simulateHighSchoolExperiment('momentum-conservation',p,6).metrics;
    expect(metrics.find(m=>m.key==='collisionTimeDefined')).toMatchObject({value:0,unit:''});
    expect(model.calculateMomentumConservation({velocity1:1,velocity2:0,separation:1},0).collisionTimeDefined).toBe(1);
  });
  it('free fall mass does not affect timing and terminal state is pre-impact with conserved energy',()=>{
    const p={dropHeight:5,mass:.2,gravity:9.8}, a=model.calculateFreeFall(p,.3), b=model.calculateFreeFall({...p,mass:1},.3), terminal=model.calculateFreeFall(p,100);
    expect(a.position).toBeCloseTo(.441,12);expect(a.velocity).toBeCloseTo(2.94,12);expect(b.position).toBe(a.position);expect(b.durationSeconds).toBe(a.durationSeconds);
    expect(terminal.height).toBe(0);expect(terminal.position).toBe(5);expect(terminal.velocity).toBeCloseTo(Math.sqrt(98),12);expect(terminal.totalEnergy).toBeCloseTo(9.8,12);
  });
});

describe('instrument readings and SI conversions',()=>{
  it('open jaws are invalid, zero-check differs from object, subtraction uses measured zero not hidden error',()=>{
    const p={instrument:0,objectLengthMm:12.34,zeroErrorMm:.03,contactMode:0,zeroCorrection:1};
    expect(model.calculatePrecisionLength(p).readingValid).toBe(0);
    const zero=model.calculatePrecisionLength({...p,contactMode:1});expect(zero.indicatedLengthMm).toBe(.04);expect(zero.objectReadingValid).toBe(0);expect(zero.correctedLengthMm).toBe(0);
    const measured=model.calculatePrecisionLength({...p,contactMode:2});expect(measured.correctedLengthMm).toBeCloseTo(measured.indicatedLengthMm!-zero.indicatedLengthMm!,12);
    expect(measured.mainScaleMm!+measured.vernierDivision!*.02).toBeCloseTo(measured.indicatedLengthMm!,12);
  });
  it('micrometer and negative zero-error scales reconstruct exactly from their visible divisions',()=>{
    for(const instrument of [0,1])for(const zeroErrorMm of [-.1,-.03,0,.1])for(const contactMode of [1,2]){
      const s=model.calculatePrecisionLength({instrument,zeroErrorMm,contactMode,objectLengthMm:12.5});
      expect(s.mainScaleMm!+(instrument===0?s.vernierDivision!*.02:s.thimbleDivision!*.01)).toBeCloseTo(s.indicatedLengthMm!,12);
      expect(s.vernierDivision).toBeGreaterThanOrEqual(0);expect(s.thimbleDivision).toBeLessThan(50);
    }
  });
  it('resistivity converts diameter and micro-ohm metre, doubling diameter quarters R; zero voltage cannot infer rho',()=>{
    const s=model.calculateResistivity({length:1,diameterMm:.5,resistivityMicroOhmM:1.1,voltage:1});
    expect(s.area).toBeCloseTo(Math.PI*.0005**2/4,15);expect(s.resistance).toBeCloseTo(1.1e-6/s.area!,12);expect(s.estimatedResistivity).toBeCloseTo(1.1e-6,15);
    expect(model.calculateResistivity({diameterMm:1}).resistance).toBeCloseTo(s.resistance!/4,12);
    expect(model.calculateResistivity({voltage:0}).estimateDefined).toBe(0);
  });
  it('voltage/current meter gate correct circuit topology, polarity and switches',()=>{
    const v=model.calculateMultimeter({});expect(v.readingValid).toBe(1);expect(v.meterValue).toBe(6);
    expect(model.calculateMultimeter({probesReversed:1}).meterValue).toBe(-6);
    expect(model.calculateMultimeter({functionMode:1,connection:1,rangeIndex:1}).meterValue).toBeCloseTo(.006,12);
    expect(model.calculateMultimeter({functionMode:1,connection:0}).readingValid).toBe(0);
    for(const patch of ([{powerOn:0},{circuitClosed:0}] as Record<string,number>[]))expect(model.calculateMultimeter(patch).meterValue).toBe(0);
  });
  it('resistance requires power-off and isolated component; overrange never becomes a zero measurement',()=>{
    for(const patch of [{functionMode:2,connection:2,powerOn:1},{functionMode:2,connection:0,powerOn:0}]) expect(model.calculateMultimeter(patch).readingValid).toBe(0);
    const r=model.calculateMultimeter({functionMode:2,connection:2,powerOn:0});expect(r.meterValue).toBe(1000);expect(r.readingValid).toBe(1);
    const over=model.calculateMultimeter({rangeIndex:0});expect(over.overRange).toBe(1);expect(over.readingValid).toBe(0);
    expect(model.calculateMultimeter({rangeIndex:0,supplyVoltage:2}).readingValid).toBe(1);
  });
  it('oil film includes calibration drops, actual drops, volume fraction and cm²/mL conversion',()=>{
    const s=model.calculateOilFilm({});expect(s.solutionDropVolumeMl).toBe(.02);expect(s.pureOilVolume).toBeCloseTo(2e-11,20);expect(s.thicknessNm).toBeCloseTo(2,12);
    expect(model.calculateOilFilm({usedDrops:2}).thickness).toBeCloseTo(s.thickness!*2,20);expect(model.calculateOilFilm({filmAreaCm2:200}).thickness).toBeCloseTo(s.thickness!/2,20);
  });
  it('gas law uses kelvin and absolute pressure; atmospheric pressure changes only gauge',()=>{
    const s=model.calculateGasPressureVolume({}), doubleV=model.calculateGasPressureVolume({volumeMl:50}), otherAtmosphere=model.calculateGasPressureVolume({atmosphericPressureKPa:90});
    expect(s.temperatureKelvin).toBe(293.15);expect(s.pV).toBeCloseTo(.001*model.IDEAL_GAS_CONSTANT*293.15,12);expect(doubleV.pressure).toBeCloseTo(s.pressure!/2,10);
    expect(otherAtmosphere.pressure).toBe(s.pressure);expect(otherAtmosphere.gaugePressureKPa).not.toBe(s.gaugePressureKPa);
  });
});

it('precision records preserve reconstructible scale components for each instrument',()=>{
  for(const instrument of [0,1]){
    const result=simulateHighSchoolExperiment('precision-length',{instrument,contactMode:2,objectLengthMm:12.34,zeroErrorMm:.04},0);
    const reading=Object.fromEntries(result.metrics.map(m=>[m.key,m.value]));
    expect(reading.mainScaleMm!+reading[instrument===0?'vernierDivision':'thimbleDivision']!*(instrument===0?.02:.01)).toBeCloseTo(reading.indicatedLengthMm!,12);
    expect(result.metrics.find(m=>m.key===(instrument===0?'vernierDivision':'thimbleDivision'))?.unit).toBe('格');
    expect(result.metrics.some(m=>m.key===(instrument===0?'thimbleDivision':'vernierDivision'))).toBe(false);
  }
});
it('photo stopping curve excludes all non-emitting frequencies except explicit theoretical threshold endpoint',()=>{
  for(const workFunctionEv of [1,2,5]){
    const result=simulateHighSchoolExperiment('photoelectric-effect',{workFunctionEv,frequencyTHz:100},0),curve=result.series.find(s=>s.key==='stoppingVoltage')!;
    expect(result.state.emissionAllowed).toBe(0);
    expect(curve.points[0]!.x).toBe(result.state.thresholdFrequencyTHz);expect(curve.points[0]!.y).toBe(0);expect(curve.label).toMatch(/理论.*阈值/);
    for(const point of curve.points.slice(1)){expect(point.x).toBeGreaterThan(result.state.thresholdFrequencyTHz!);expect(point.y).toBeGreaterThan(0);}
  }
});

describe('optics electromagnetism and modern boundaries',()=>{
  it('Snell relation, normal incidence and critical-angle/TIR flags are physically distinct',()=>{
    const s=model.calculateRefractiveIndex({incidentIndex:1,transmittedIndex:1.5,incidentAngleDegrees:30});expect(1.5*s.sinRefracted!).toBeCloseTo(.5,12);expect(s.indexRatioEstimate).toBeCloseTo(1.5,12);
    const normal=model.calculateRefractiveIndex({incidentAngleDegrees:0});expect(normal.transmissionValid).toBe(1);expect(normal.estimateDefined).toBe(0);
    const subnormal=model.calculateRefractiveIndex({incidentIndex:1,transmittedIndex:2,incidentAngleDegrees:2e-322});expect(Object.values(subnormal).every(Number.isFinite)).toBe(true);
    const critical=Math.asin(1/1.5)*180/Math.PI;
    const edge=model.calculateRefractiveIndex({incidentIndex:1.5,transmittedIndex:1,incidentAngleDegrees:critical});expect(edge.totalInternalReflection).toBe(0);expect(edge.refractedAngleDegrees).toBeCloseTo(90,10);
    const tir=model.calculateRefractiveIndex({incidentIndex:1.5,transmittedIndex:1,incidentAngleDegrees:critical+.01});expect(tir.transmissionValid).toBe(0);expect(tir.transmittedDirectionY).toBe(0);
  });
  it('induction equals analytic minus-N derivative, opening retains emf but prevents current',()=>{
    const p={fieldAmplitude:.1,areaCm2:50,turns:100,rotationFrequency:.5,phaseDegrees:0,resistance:10,closed:1};
    const s=model.calculateInducedCurrent(p,.5);expect(s.flux).toBeCloseTo(0,12);expect(s.fluxRate).toBeCloseTo(-.0005*Math.PI,12);expect(s.emf).toBeCloseTo(.05*Math.PI,12);expect(s.current).toBeCloseTo(s.emf!/10,12);
    const dt=1e-5,t=.31, derivative=(model.calculateInducedCurrent(p,t+dt).flux!-model.calculateInducedCurrent(p,t-dt).flux!)/(2*dt);
    expect(model.calculateInducedCurrent(p,t).emf).toBeCloseTo(-100*derivative,9);
    const open=model.calculateInducedCurrent({...p,closed:0},.5);expect(open.emf).toBe(s.emf);expect(open.current).toBe(0);
    expect(model.calculateInducedCurrent({...p,rotationFrequency:0},1).emf).toBe(0);
  });
  it('transformer conserves RMS power and has correct sine peak, rejects DC interpretation without nonfinite outputs',()=>{
    const s=model.calculateTransformerRatio({},.005);expect(s.secondaryRmsVoltage).toBe(12);expect(s.secondaryVoltage).toBeCloseTo(12*Math.SQRT2,12);expect(s.primaryPower).toBeCloseTo(s.secondaryPower!,12);expect(s.primaryCurrentRms).toBeCloseTo(.24,12);
    expect(model.calculateTransformerRatio({inputMode:1}).readingValid).toBe(0);expect(model.calculateTransformerRatio({primaryRmsVoltage:0}).primaryCurrentRms).toBe(0);
  });
  it('sensor response is exponential; hysteresis state in deadband is remembered for both warming and cooling',()=>{
    const s=model.calculateSensorControl({},1);expect(s.sensorTemperature).toBeCloseTo(60-40/Math.E,12);expect(s.outputVoltage).toBeCloseTo(.025*(s.sensorTemperature!+20),12);
    expect(model.calculateSensorControl({temperatureStart:40,temperatureEnd:40,initialRelayOn:1},5).relayOn).toBe(1);
    expect(model.calculateSensorControl({temperatureStart:40,temperatureEnd:40,initialRelayOn:0},5).relayOn).toBe(0);
    expect(model.calculateSensorControl({temperatureStart:60,temperatureEnd:40,initialRelayOn:0},12).relayOn).toBe(1);
    expect(model.calculateSensorControl({temperatureStart:60,temperatureEnd:20},12).relayOn).toBe(0);
  });
  it('draws the relay transition at the analytic threshold time without intermediate on states', () => {
    const warming = simulateHighSchoolExperiment('sensor-control', defaultHighSchoolParameters('sensor-control'), 0);
    const relay = warming.series.find(series => series.key === 'relayOn')!;
    const crossing = -Math.log((41 - 60) / (20 - 60));
    const event = relay.points.filter(point => Math.abs(point.x - crossing) < 1e-10);
    expect(event.map(point => point.y)).toEqual([0, 1]);
    expect(relay.points.every(point => point.y === 0 || point.y === 1)).toBe(true);

    const cooling = simulateHighSchoolExperiment('sensor-control', { temperatureStart: 60, temperatureEnd: 20 }, 0);
    const off = cooling.series.find(series => series.key === 'relayOn')!;
    const offTime = -Math.log((39 - 20) / (60 - 20));
    expect(off.points.filter(point => Math.abs(point.x - offTime) < 1e-10).map(point => point.y)).toEqual([1, 0]);
  });
  it('photoelectric intensity changes current but not stopping potential, below threshold cannot emit',()=>{
    const a=model.calculatePhotoelectricEffect({}), b=model.calculatePhotoelectricEffect({opticalPowerMilliwatts:2});expect(b.stoppingVoltage).toBe(a.stoppingVoltage);expect(b.current).toBeCloseTo(a.current!*2,12);
    expect(a.maxKineticEnergyEv).toBeCloseTo(model.PLANCK_CONSTANT*800e12/model.ELEMENTARY_CHARGE-2,12);
    const below=model.calculatePhotoelectricEffect({frequencyTHz:100,opticalPowerMilliwatts:5});expect(below.emissionAllowed).toBe(0);expect(below.current).toBe(0);
    expect(model.calculatePhotoelectricEffect({opticalPowerMilliwatts:0}).emitting).toBe(0);
    expect(model.calculatePhotoelectricEffect({collectorVoltage:-a.stoppingVoltage!}).current).toBeCloseTo(0,14);
  });
  it('Lorentz sign, circle centre, speed conservation and derivative use the same analytic trajectory',()=>{
    const s=model.calculateChargedParticleField({},.05);expect(s.y).toBeLessThan(0);expect(s.ay).toBeLessThan(0);expect(s.radius).toBeCloseTo(200,12);
    expect(Math.hypot(s.x!-s.centerX!,s.y!-s.centerY!)).toBeCloseTo(s.radius!,10);expect(Math.hypot(s.vx!,s.vy!)).toBeCloseTo(s.speed!,10);
    const opposite=model.calculateChargedParticleField({chargeToMassMillions:-1},.05);expect(opposite.x).toBeCloseTo(s.x!,10);expect(opposite.y).toBeCloseTo(-s.y!,10);
    const h=1e-6, a=model.calculateChargedParticleField({},.05-h),b=model.calculateChargedParticleField({},.05+h);expect((b.x!-a.x!)/(2*h)).toBeCloseTo(s.vx!,6);expect((b.y!-a.y!)/(2*h)).toBeCloseTo(s.vy!,6);
  });
  it('zero and extremely weak fields have finite straight-line limit rather than infinite metrics',()=>{
    for(const p of ([{magneticFieldMicrotesla:0},{chargeToMassMillions:0},{magneticFieldMicrotesla:1e-310}] as Record<string,number>[])){
      const s=model.calculateChargedParticleField(p,.5);expect(Object.values(s).every(Number.isFinite)).toBe(true);expect(s.x).toBeCloseTo(1000,10);expect(s.y).toBeCloseTo(0,10);
    }
    expect(model.calculateChargedParticleField({magneticFieldMicrotesla:0},1).radiusDefined).toBe(0);
  });
});
