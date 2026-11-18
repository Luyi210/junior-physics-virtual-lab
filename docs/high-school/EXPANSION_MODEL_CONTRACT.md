# 高中剩余14项模型接口（阶段24）

本文件是物理模型、界面、分析与助手的共同契约。全部为理想教学模型，自动采样不是实体测量。现有10项及电容器完整历史协议保持不变。`simulateHighSchoolExperiment(id, parameters, timeSeconds)` 沿用现有入口。以下纯计算函数均导出，接受对应参数对象与可选时间，返回数值 state；参数合法性仍由统一 catalog 校验，函数也会校验。所有数值有限，无定义量用0占位并配明确 flag，不得把占位当读数。时间限定在观察窗内；静态项目 durationSeconds=0。

参数记法为“范围；默认”，未写单位者为无量纲。枚举必须属于 choices，整数计数有 integral:true；step 仅是界面步长，不强迫普通连续输入落在网格。下列 state 中 time 为秒。metric 通常使用同名 key/下述单位，readingValid 是0/1有效性标识，不是评分。

## 1 centripetal-force — calculateCentripetalForce

- 参数：mass kg [.05,1];.2；radius m [.1,1];.5；angularSpeed rad/s [-6,6];2。
- 时长8s。state：time,angleRadians,x,y(m),vx,vy,speed(m/s),acceleration(m/s²),force,forceX,forceY(N),angularSpeedSquared(s⁻²),period(s),periodDefined。
- x=r cosωt,y=r sinωt，力指向圆心；负ω顺时针。ω=0时周期无定义，period=0/periodDefined=0，不显示“周期0秒”。
- 曲线：x/y–t，F–ω²（固定m/r）；分析可用保存 force 对 angularSpeedSquared。

## 2 precision-length — calculatePrecisionLength

- 参数：instrument choices 0游标卡尺(0.02mm)/1螺旋测微器(0.01mm)，默认0；objectLengthMm [0,25];12.34；zeroErrorMm [-.1,.1];.04；contactMode choices 0未接触/1合拢检查零点/2夹住物体，默认0；zeroCorrection choices 0未扣零点/1扣除零点，默认0。
- 静态。state：time,objectLengthMm,indicatedLengthMm,correctedLengthMm,zeroReadingMm,divisionMm,mainScaleMm,vernierDivision,thimbleDivision,readingValid,objectReadingValid,contactMode,instrument。
- 指示值由量化后的物体长度+零误差得到；零点读数独立量化，扣除它得到修正值。零检查有效但不是物体长度。未接触时 readingValid=0，数值占位不得保存为测量。
- 卡尺主尺为整mm，50分格游标；测微器主尺为0.5mm，50分格微分筒。负零误差允许主尺负值，分度索引仍0–49。零误差不等于分辨率。曲线：同仪器 indicatedLengthMm–objectLengthMm，明确为量化模型而非学生读数。

## 3 resistivity — calculateResistivity

- 参数：length m [.1,2];1；diameterMm [.1,1];.5；resistivityMicroOhmM [.1,2];1.1；voltage V [0,3];1。
- 静态。state：time,length,diameterMm,area(m²),resistivity(Ωm),resistance(Ω),voltage(V),current(A),power(W),estimatedResistivity(Ωm),estimateDefined。
- 均匀圆导线，温度固定，不模拟发热改变电阻率；A=πd²/4,R=ρL/A。U=0时I=0，不能从U/I估ρ，估计占位0并flag0。
- 曲线I–U及R–L。分析R–L固定d/ρ；保存U/I推导是模型一致性，不是独立验证。

## 4 multimeter — calculateMultimeter

- 参数：functionMode choices 0直流电压/1直流电流/2电阻，默认0；rangeIndex choices 0低/1中/2高，默认1；connection choices 0并联待测电阻/1串联/2隔离元件，默认0；powerOn,circuitClosed choices 0否/1是，均默认1；probesReversed choices 0正常/1反接，默认0；supplyVoltage V [0,12];6；resistanceOhms Ω [10,10000];1000。
- 三挡量程分别V=[2,20,200]、A=[.002,.02,.2]、Ω=[200,2000,20000]。2000计数理想数字表，分辨率=量程/2000；超量程判断在量化前且等于满量程允许。
- 静态。state：time,supplyVoltage,resistanceOhms,physicalVoltage,physicalCurrent,meterValue,selectedRange,resolution,configurationValid,overRange,readingValid,functionMode,connection,powerOn,circuitClosed,probesReversed。
- V需并联，A需串联；电源断开或总开关开路时负载U/I为0。Ω需断电且隔离元件，表内测量电源隐含。错误接法或超量程 readingValid=0，meterValue占位0，不代表真实读数或模拟危险短路。V/A反接为负，Ω无极性。
- 曲线physicalCurrent–supplyVoltage说明理想被测回路，不能冒充无效表接法的读数。

## 5 momentum-conservation — calculateMomentumConservation

- 参数：mass1,mass2 kg [.1,2];.5；velocity1 m/s [-3,3];1；velocity2 [-3,3];-1；separation m [.2,3];1；restitution [0,1];1。
- 时长6s。质点初位x1=-separation/2,x2=+separation/2。只有v1>v2才相遇，tc=separation/(v1-v2)；超出观察窗不假造碰撞。极小接近速度导致时刻不可表示时collisionTime=0且collisionTimeDefined=0；该占位不是0秒碰撞。
- state：time,x1,x2,velocity1,velocity2,totalMomentum(kg·m/s),kineticEnergy,initialKineticEnergy,energyLoss(J),collisionTime(s),collisionTimeDefined,collisionPredicted,collisionWithinWindow,collided。
- 相遇前速度保持输入，相遇后使用动量守恒及恢复系数。e=0粘连共速，e=1弹性；不模拟有限球尺寸/变形。曲线x1/x2–t及K–t，碰撞左右极限保留。

## 6 refractive-index — calculateRefractiveIndex

- 参数：incidentIndex [1,2];1；transmittedIndex [1,2];1.5；incidentAngleDegrees ° [0,85];40。
- 静态。state：time,incidentAngleDegrees,refractedAngleDegrees,reflectionAngleDegrees,sinIncident,sinRefracted,criticalAngleDegrees,criticalDefined,totalInternalReflection,transmissionValid,readingValid,indexRatioEstimate,estimateDefined,incidentDirectionX/Y,reflectedDirectionX/Y,transmittedDirectionX/Y。
- 界面y=0，入射方向(sin i,-cos i)，反射(sin i,+cos i)，透射(sin r,-cos r)。n1 sin i=n2 sin r；全反射时透射角/方向占位0，transmissionValid/readingValid=0，但全反射现象本身可观察。临界角透射沿界面，不算全反射。正入射两正弦均0，不能用其比值估折射率。
- 曲线sin r–sin i仅保留可透射点；分析需检查transmissionValid及非零入射角。

## 7 induced-current — calculateInducedCurrent

- 参数：fieldAmplitude T [0,.5];.1；areaCm2 [10,200];50；turns整数[1,500];100；rotationFrequency Hz [-2,2];.5；phaseDegrees ° [-180,180];0；resistance Ω [1,100];10；closed choices 0开路/1闭路，默认1。
- 时长4s。state：time,angleRadians,flux(Wb每匝),fluxRate(Wb/s每匝),fluxLinkage(Wb匝),emf(V),current(A),field(T),area(m²),turns,resistance,closed。
- 均匀恒定磁场沿+z，线圈正法向与+z夹角θ=phase+2πft；Φ=BAcosθ，ε=NBAωsinθ=-N dΦ/dt。电流正向按线圈正法向右手定则，不是移动磁铁模型。开路I=0但ε可非零；忽略自感及机械反作用，旋转由外部驱动。曲线Φ/ε/I–t。

## 8 transformer-ratio — calculateTransformerRatio

- 参数：primaryTurns整数[50,1000];200；secondaryTurns整数[50,1000];400；primaryRmsVoltage V [0,24];6；frequency Hz [1,100];50；loadResistance Ω [10,1000];100；inputMode choices 0交流正弦/1直流(不适用)，默认0。
- 观察窗3/f秒，频率为实际物理频率，曲线为完整三周期；不声称慢动作波形有真实墙钟频率。
- state：time,primaryVoltage,secondaryVoltage(V瞬时),primaryRmsVoltage,secondaryRmsVoltage,primaryCurrentRms,secondaryCurrentRms(A),primaryPower,secondaryPower(W),turnsRatio,primaryTurns,secondaryTurns,readingValid,inputMode。
- 理想无损变压器及纯阻性负载；U2/U1=N2/N1，U1I1=U2I2。零电源时所有电流/功率0，无0/0。直流不适用，readingValid=0、输出占位0，不推算直流升压/铁芯饱和或开关瞬态。曲线瞬时原/副电压–t、有效值U2–N2。

## 9 sensor-control — calculateSensorControl

- 参数：temperatureStart °C [0,80];20；temperatureEnd °C [0,80];60；threshold °C [10,70];40；hysteresis °C [0,10];2；responseTime s [.1,3];1；initialRelayOn choices 0关/1开，默认0。
- 时长12s。state：time,sensorTemperature,environmentTemperature,outputVoltage(V),relayOn,upperThreshold,lowerThreshold。
- 环境在t0阶跃；传感器T=Tend+(Tstart−Tend)e^(−t/τ)，输出V=.025(T+20)。这是自定理想线性传感器，不模拟NTC或特定商品器件。上下阈值=threshold±hysteresis/2；达上限开、达下限关，中间保持初始状态。输入是单调阶跃，因此解析状态不需要未保存的开关历史；改参数重新开始。无滞回且恰阈值规定开。曲线T/V/relay–t。

## 10 oil-film — calculateOilFilm

- 参数：calibrationVolumeMl [1,5];1；calibrationDrops整数[20,100];50；usedDrops整数[1,5];1；oilVolumeFraction [.0001,.01];.001；filmAreaCm2 [10,200];100。
- 静态。state：time,solutionDropVolumeMl,pureOilVolume(m³),filmArea(m²),filmAreaCm2,inverseArea(m⁻²),thickness(m),thicknessNm。
- 溶液平均滴体积=标定体积/滴数；纯油体积=每滴溶液体积×滴数×体积分数；d=V纯油/S。假定溶剂挥发、完整单分子层及无损耗；厚度仅作分子尺度估计，不自动识别铺展面积或真实分子直径。曲线d–1/S。

## 11 gas-pressure-volume — calculateGasPressureVolume

- 参数：amountMilliMol [.1,5];1；volumeMl [10,100];25；temperatureCelsius [-50,100];20；atmosphericPressureKPa [80,120];101.325。
- 静态。state：time,temperatureKelvin,amountMoles,volume(m³),volumeMl,inverseVolume(m⁻³),pressure(Pa绝压),pressureKPa,gaugePressureKPa,pV(J)。
- pV=nRT，R=8.31446261815324。表压=p绝压−p大气可为负；气体温度用K，比较等温关系固定n/T。无泄漏、摩擦或压缩升温动态，参数代表平衡态。曲线p–V与p–1/V。

## 12 free-fall — calculateFreeFall

- 参数：dropHeight m [.1,20];5；mass kg [.05,1];.2；gravity m/s² [1.6,20];9.8。
- 时长sqrt(2H/g)，从静止真空下落，到地面前一瞬停止，不模拟撞击。state：time,timeSquared,position(向下m),height(剩余m),velocity(向下m/s),acceleration,kineticEnergy,potentialEnergy,totalEnergy(J),durationSeconds。
- 质量不影响理想下落加速度和落地时刻。曲线position–t²、velocity–t，分析固定H/g或同条件组，不从能量反推独立测量速度。

## 13 photoelectric-effect — calculatePhotoelectricEffect

- 参数：frequencyTHz [100,1500];800；workFunctionEv [1,5];2；opticalPowerMilliwatts [0,5];1；collectorVoltage V [-5,5];1。
- 静态。state：time,frequencyTHz,collectorVoltage,photonEnergyEv,thresholdFrequencyTHz,maxKineticEnergyEv,stoppingVoltage(V),saturationCurrent,current(A),emissionAllowed,emitting。
- h/e使用SI定义精确值。hν>W时正最大动能，等阈值为零动能边界；光功率0时无电流。阈值及理论遏止电压不随光强改变。固定10%量子效率；示意I–V额外假定电子初始动能均匀分布，负收集电压线性抑制至零，非通用实测伏安曲线。正电压饱和。无发射时不把0V称为已测遏止电压。曲线遏止电压–频率及I–收集电压。

## 14 charged-particle-field — calculateChargedParticleField

- 参数：chargeToMassMillions [−2,2];1，单位10⁶ C/kg（有符号）；speedKmPerSecond [.1,10];2；magneticFieldMicrotesla [−20,20];10；initialAngleDegrees ° [−180,180];0。
- 时长1s。state：time,x,y(m),vx,vy,speed(m/s),ax,ay(m/s²),angularFrequency(rad/s有符号),radius(m),radiusDefined,period(s),periodDefined,centerX,centerY(m),specificKineticEnergy(J/kg),chargeToMass,magneticField。
- B沿+z为正，a=(q/m)v×B，正q正B初速+x时向−y偏。速度方向α−ωt，ω=(q/m)B；用稳定sinc形式积分位置。同一公式生成轨迹和速度，反号改变转向。B=0或q/m=0为直线，半径/周期无定义。极端接近0导致不可表示半径时flag0，不输出Infinity。非相对论匀强磁场，无电场/辐射损耗。曲线y–x与speed–t。
