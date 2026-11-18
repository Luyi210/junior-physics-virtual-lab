import type { HighSchoolExperimentId, HighSchoolSimulation, HighSchoolSeries } from './types';
import * as calculators from '@physics-lab/physics/high-school/expandedModels';
import { EXPANDED_HIGH_SCHOOL_EXPERIMENTS } from '@physics-lab/physics/high-school/expansionCatalog';

type State = Record<string, number>;
type Fields = [key: string, label: string, unit: string][];
export type ExpandedModel = Omit<HighSchoolSimulation, 'state' | 'metrics'> & { at(time: number): State; metricFields: Fields };
const line = (rows: State[], key: string, label: string, xKey: string, xLabel: string, xUnit: string, yUnit: string): HighSchoolSeries => ({ key, label, xKey, xLabel, xUnit, yUnit, points: rows.map(s => ({ x: s[xKey]!, y: s[key]! })) });
const scan = (from: number, to: number, calculate: (x: number) => State, count = 120) => Array.from({length: count + 1}, (_, i) => calculate(from + (to - from) * i / count));
export function createExpandedModel(id: HighSchoolExperimentId, p: Record<string, number>): ExpandedModel | undefined {
  const definition = EXPANDED_HIGH_SCHOOL_EXPERIMENTS.find(e => e.id === id);
  if (!definition) return undefined;
  let at: (time: number) => State, durationSeconds = 0, metricFields: Fields, series: HighSchoolSeries[], equations: string[];
  const warnings = [...definition.assumptions];
  switch (id) {
    case 'centripetal-force': {
      at = t => calculators.calculateCentripetalForce(p,t); durationSeconds = 8;
      const rows = scan(0,8,at,240), characteristic = scan(0,6,w=>calculators.calculateCentripetalForce({...p,angularSpeed:w}));
      metricFields = [['force','向心力','N'],['speed','速率','m/s'],['acceleration','向心加速度','m/s²'],['angularSpeedSquared','角速度平方','s⁻²'],['period','周期（须有效标识）','s'],['periodDefined','周期有定义','']];
      series = [line(rows,'x','x坐标—时间','time','时间','s','m'),line(rows,'y','y坐标—时间','time','时间','s','m'),line(characteristic,'force','同质量半径：F—ω²','angularSpeedSquared','角速度平方','s⁻²','N')]; equations = ['F=mrω²=mv²/r','T=2π/|ω|（ω≠0）']; break;
    }
    case 'precision-length': {
      at = () => calculators.calculatePrecisionLength(p);
      // Characteristic explicitly describes contacting the object; the live invalid
      // cursor is suppressed by readingValid in the consumer.
      const rows = scan(0,25,x=>calculators.calculatePrecisionLength({...p,objectLengthMm:x,contactMode:2}),500);
      metricFields = [['indicatedLengthMm','刻度指示值','mm'],['correctedLengthMm','选定零点修正后读数','mm'],['zeroReadingMm','合拢零点读数','mm'],['divisionMm','显示分辨率','mm'],['mainScaleMm','主尺读数','mm'],p.instrument === 0 ? ['vernierDivision','游标重合分格','格'] : ['thimbleDivision','微分筒分格','格'],['readingValid','有效读数',''],['objectReadingValid','物体读数有效','']];
      series = [line(rows,'indicatedLengthMm','接触物体时量化指示','objectLengthMm','模型物体长度','mm','mm')]; equations = ['示数=分辨率量化(实际长度+零误差)','修正读数=示数−零点读数（启用修正时）'];
      if (!at(0).readingValid) warnings.push('当前尚未接触，刻度数值占位不是有效读数。'); break;
    }
    case 'resistivity': {
      at = () => calculators.calculateResistivity(p);
      metricFields = [['length','导线长度','m'],['diameterMm','导线直径','mm'],['area','截面积','m²'],['resistance','导线电阻','Ω'],['voltage','电压','V'],['current','电流','A'],['resistivity','设置电阻率','Ω·m'],['estimatedResistivity','由U/I算得电阻率','Ω·m'],['estimateDefined','电阻率估计有效','']];
      series = [line(scan(0,3,v=>calculators.calculateResistivity({...p,voltage:v})),'current','同一导线I—U','voltage','电压','V','A'),line(scan(.1,2,length=>calculators.calculateResistivity({...p,length})),'resistance','固定材料直径R—L','length','长度','m','Ω')]; equations = ['A=πd²/4','R=ρL/A，I=U/R','ρ=(U/I)A/L（I≠0）']; break;
    }
    case 'multimeter': {
      at = () => calculators.calculateMultimeter(p); const s = at(0), unit = ['V','A','Ω'][p.functionMode!]!;
      metricFields = [['meterValue','表计读数（须有效标识）',unit],['selectedRange','所选量程',unit],['resolution','显示分辨率',unit],['configurationValid','接法与供电合适',''],['overRange','超量程',''],['readingValid','有效读数',''],['physicalVoltage','负载模型电压','V'],['physicalCurrent','负载模型电流','A']];
      series = [line(scan(0,12,supplyVoltage=>calculators.calculateMultimeter({...p,supplyVoltage})),'physicalCurrent','理想被测回路I—电源电压','supplyVoltage','电源电压','V','A')]; equations = ['负载接通时I=U/R','电压并联；电流串联；电阻断电且隔离'];
      if (!s.configurationValid) warnings.push('当前接法或供电不适用，表计无有效读数。'); else if (s.overRange) warnings.push('当前超过所选量程，请换更大量程；0占位不表示零读数。'); break;
    }
    case 'momentum-conservation': {
      at = t => calculators.calculateMomentumConservation(p,t); durationSeconds = 6;
      const initial = at(0), times = scan(0,6, t=>({time:t})).map(s=>s.time!);
      if (initial.collisionWithinWindow) { const tc = initial.collisionTime!; times.push(Math.max(0,tc - Math.max(tc * 1e-10,1e-12)),tc); }
      const rows = [...new Set(times)].sort((a,b)=>a-b).map(at);
      metricFields = [['totalMomentum','系统总动量','kg·m/s'],['kineticEnergy','系统动能','J'],['initialKineticEnergy','初始动能','J'],['energyLoss','碰撞动能损耗','J'],['velocity1','左物体速度','m/s'],['velocity2','右物体速度','m/s'],['collided','已经相遇碰撞',''],['collisionWithinWindow','本观察窗内会碰撞',''],['collisionPredicted','未来相遇条件成立',''],['collisionTime','预计碰撞时刻（须有效标识）','s'],['collisionTimeDefined','碰撞时刻可表示','']];
      series = [line(rows,'x1','左物体位置','time','时间','s','m'),line(rows,'x2','右物体位置','time','时间','s','m'),line(rows,'kineticEnergy','系统动能—时间','time','时间','s','J')]; equations = ['m₁u₁+m₂u₂=m₁v₁+m₂v₂','v₂−v₁=e(u₁−u₂)（真正相遇后）'];
      if (!initial.collisionWithinWindow) warnings.push(initial.collisionPredicted ? '预计碰撞在6秒观察窗之后，本轮尚未观察到碰撞。' : '两物体不相互接近，本轮不会发生碰撞。'); break;
    }
    case 'refractive-index': {
      at = () => calculators.calculateRefractiveIndex(p);
      const s = at(0), end = Math.min(85,s.criticalDefined ? s.criticalAngleDegrees! : 85);
      metricFields = [['incidentAngleDegrees','入射角','°'],['refractedAngleDegrees','折射角（须透射标识）','°'],['sinIncident','入射角正弦',''],['sinRefracted','折射角正弦',''],['transmissionValid','存在透射光',''],['readingValid','折射角读数有效',''],['totalInternalReflection','全反射',''],['indexRatioEstimate','n₂/n₁估计',''],['estimateDefined','正弦比估计有效','']];
      series = [line(scan(0,end,incidentAngleDegrees=>calculators.calculateRefractiveIndex({...p,incidentAngleDegrees})),'sinRefracted','可透射角的正弦关系','sinIncident','入射角正弦','','')]; equations = ['n₁sin i=n₂sin r','临界角sin c=n₂/n₁（n₁>n₂）'];
      if (s.totalInternalReflection) warnings.push('发生全反射，折射角无定义；请勿把0占位当成垂直透射。'); break;
    }
    case 'induced-current': {
      at = t => calculators.calculateInducedCurrent(p,t); durationSeconds = 4; const rows = scan(0,4,at,480);
      metricFields = [['flux','每匝磁通量','Wb'],['fluxRate','每匝磁通变化率','Wb/s'],['emf','有符号感应电动势','V'],['current','有符号感应电流','A'],['fluxLinkage','磁通链','Wb·匝']];
      series = [line(rows,'flux','每匝磁通—时间','time','时间','s','Wb'),line(rows,'emf','感应电动势—时间','time','时间','s','V'),line(rows,'current','电流—时间','time','时间','s','A')]; equations = ['Φ=BAcosθ，θ=θ₀+2πft','ε=−N dΦ/dt=NBAωsinθ','闭路I=ε/R；开路I=0']; break;
    }
    case 'transformer-ratio': {
      at = t => calculators.calculateTransformerRatio(p,t); durationSeconds = 3 / p.frequency!; const rows = scan(0,durationSeconds,at,240);
      metricFields = [['primaryRmsVoltage','原线圈电压有效值','V'],['secondaryRmsVoltage','副线圈电压有效值','V'],['primaryCurrentRms','原线圈电流有效值','A'],['secondaryCurrentRms','副线圈电流有效值','A'],['primaryPower','输入平均功率','W'],['secondaryPower','输出平均功率','W'],['turnsRatio','副/原匝数比',''],['readingValid','交流稳态模型有效','']];
      const characteristic = Array.from({length:96},(_,i)=>calculators.calculateTransformerRatio({...p,secondaryTurns:50+i*10}));
      series = [line(rows,'primaryVoltage','原线圈瞬时电压','time','物理时间','s','V'),line(rows,'secondaryVoltage','副线圈瞬时电压','time','物理时间','s','V'),line(characteristic,'secondaryRmsVoltage','固定原线圈条件U₂—N₂','secondaryTurns','副线圈匝数','匝','V')]; equations = ['U₂/U₁=N₂/N₁（交流有效值）','U₁I₁=U₂I₂（理想纯阻负载）']; if (!at(0).readingValid) warnings.push('直流不属于本交流稳态模型；副边0是无效占位，不是直流接通瞬态预测。'); break;
    }
    case 'sensor-control': {
      at = t => calculators.calculateSensorControl(p,t); durationSeconds = 12; const rows = scan(0,12,at,240);
      // A relay is binary. Add both sides of the analytically determined
      // threshold crossing so the graph has a vertical jump, not a fictitious
      // interval of partly-on states between two regular samples.
      const initial = rows[0]!, warming = p.temperatureEnd! > p.temperatureStart!;
      const nextRelay = warming ? 1 : 0;
      const relayRows = [...rows];
      if (p.temperatureEnd !== p.temperatureStart && initial.relayOn !== nextRelay) {
        const boundary = warming ? initial.upperThreshold! : initial.lowerThreshold!;
        const ratio = (boundary - p.temperatureEnd!) / (p.temperatureStart! - p.temperatureEnd!);
        if (ratio > 0 && ratio < 1) {
          const crossing = -p.responseTime! * Math.log(ratio);
          if (crossing > 0 && crossing < durationSeconds) {
            const atCrossing = at(crossing);
            for (let index = relayRows.length - 1; index >= 0; index--) {
              if (Math.abs(relayRows[index]!.time! - crossing) < 1e-10) relayRows.splice(index, 1);
            }
            relayRows.push({ ...atCrossing, relayOn: initial.relayOn! }, { ...atCrossing, relayOn: nextRelay });
            relayRows.sort((a,b) => a.time! - b.time!);
          }
        }
      }
      metricFields = [['sensorTemperature','传感器温度','°C'],['environmentTemperature','环境温度','°C'],['outputVoltage','传感器电压','V'],['relayOn','阈值开关开启',''],['upperThreshold','开启阈值','°C'],['lowerThreshold','关闭阈值','°C']];
      series = [line(rows,'sensorTemperature','响应温度—时间','time','时间','s','°C'),line(rows,'outputVoltage','输出电压—时间','time','时间','s','V'),line(relayRows,'relayOn','带滞回开关—时间','time','时间','s','')]; equations = ['Tₛ=T末+(T初−T末)e^(−t/τ)','V=0.025(Tₛ+20)','达上阈值开，达下阈值关，区间内保持']; break;
    }
    case 'oil-film': {
      at = () => calculators.calculateOilFilm(p);
      metricFields = [['solutionDropVolumeMl','平均溶液滴体积','mL'],['pureOilVolume','铺展纯油体积','m³'],['filmArea','单分子层面积','m²'],['thickness','估计膜厚','m'],['thicknessNm','估计膜厚','nm'],['inverseArea','面积倒数','m⁻²']];
      const rows = scan(10,200,filmAreaCm2=>calculators.calculateOilFilm({...p,filmAreaCm2})).sort((a,b)=>a.inverseArea!-b.inverseArea!);
      series = [line(rows,'thickness','固定纯油体积：膜厚—面积倒数','inverseArea','面积倒数','m⁻²','m')]; equations = ['V纯油=(V标定/N标定)×N使用×体积分数','d=V纯油/S']; break;
    }
    case 'gas-pressure-volume': {
      at = () => calculators.calculateGasPressureVolume(p); const rows = scan(10,100,volumeMl=>calculators.calculateGasPressureVolume({...p,volumeMl}));
      metricFields = [['pressure','绝对压强','Pa'],['pressureKPa','绝对压强','kPa'],['gaugePressureKPa','相对大气表压','kPa'],['volume','气体体积','m³'],['temperatureKelvin','绝对温度','K'],['amountMoles','物质的量','mol'],['pV','绝压与体积乘积','J']];
      series = [line(rows,'pressure','同温同量p—V','volume','体积','m³','Pa'),line([...rows].reverse(),'pressure','同温同量p—1/V','inverseVolume','体积倒数','m⁻³','Pa')]; equations = ['p绝压V=nRT，T=t摄氏+273.15','p表压=p绝压−p大气']; break;
    }
    case 'free-fall': {
      at = t => calculators.calculateFreeFall(p,t); durationSeconds = at(0).durationSeconds!; const rows = scan(0,durationSeconds,at);
      metricFields = [['position','向下位移','m'],['height','剩余高度','m'],['velocity','向下速度','m/s'],['acceleration','加速度','m/s²'],['durationSeconds','下落时长','s'],['kineticEnergy','动能','J'],['potentialEnergy','重力势能','J'],['totalEnergy','机械能','J']];
      series = [line(rows,'position','位移—时间平方','timeSquared','时间平方','s²','m'),line(rows,'velocity','速度—时间','time','时间','s','m/s')]; equations = ['x=½gt²，v=gt','t落地=√(2H/g)']; break;
    }
    case 'photoelectric-effect': {
      at = () => calculators.calculatePhotoelectricEffect(p);
      metricFields = [['photonEnergyEv','单光子能量','eV'],['maxKineticEnergyEv','最大初动能','eV'],['stoppingVoltage','理论遏止电压（须发射条件）','V'],['saturationCurrent','模型饱和电流','A'],['current','模型收集电流','A'],['emissionAllowed','存在正超额能量',''],['emitting','当前有光电子产生',''],['thresholdFrequencyTHz','阈值频率','THz']];
      const threshold = at(0).thresholdFrequencyTHz!;
      const emissionRows = scan(threshold,1500,frequencyTHz=>calculators.calculatePhotoelectricEffect({...p,frequencyTHz}));
      // The zero endpoint marks the theoretical threshold, not a measured
      // stopping potential in a region without photoelectron emission.
      emissionRows[0] = { ...emissionRows[0]!, stoppingVoltage: 0 };
      series = [line(emissionRows,'stoppingVoltage','正超额能量区：理论遏止电压—频率（零端点为阈值）','frequencyTHz','光频率','THz','V'),line(scan(-5,5,collectorVoltage=>calculators.calculatePhotoelectricEffect({...p,collectorVoltage})),'current','附加均匀能量分布假设的I—V','collectorVoltage','收集极电压','V','A')]; equations = ['K最大=hν−W（hν>W）','eU遏止=K最大','饱和电流=0.1 eP/(hν)（有发射时）']; break;
    }
    case 'charged-particle-field': {
      at = t => calculators.calculateChargedParticleField(p,t); durationSeconds = 1; const rows = scan(0,1,at,480);
      metricFields = [['speed','速率','m/s'],['radius','曲率半径（须有效标识）','m'],['radiusDefined','半径有定义',''],['period','周期（须有效标识）','s'],['periodDefined','周期有定义',''],['specificKineticEnergy','单位质量动能','J/kg'],['angularFrequency','有符号回旋角频率','rad/s']];
      series = [line(rows,'y','同源洛伦兹轨迹','x','x坐标','m','m'),line(rows,'speed','速率—时间','time','时间','s','m/s')]; equations = ['a=(q/m)v×B','ω=(q/m)B，r=v/|ω|（ω≠0）','速度方向角=α−ωt']; break;
    }
    default: return undefined;
  }
  return {at,durationSeconds,metricFields,series,equations,warnings};
}
