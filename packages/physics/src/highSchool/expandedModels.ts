import { validatedHighSchoolParameters } from '@physics-lab/physics/high-school/catalog';
import { boundedTime } from '@physics-lab/physics/high-school/types';

type Parameters = Record<string, number>;
const TAU = 2 * Math.PI;
const degrees = Math.PI / 180;
export const PLANCK_CONSTANT = 6.62607015e-34;
export const ELEMENTARY_CHARGE = 1.602176634e-19;
export const IDEAL_GAS_CONSTANT = 8.31446261815324;
const quantize = (value: number, resolution: number) => Number((Math.round(value / resolution) * resolution).toPrecision(14));

export function calculateCentripetalForce(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('centripetal-force', input);
  const time = boundedTime(requestedTime, 8), angleRadians = p.angularSpeed! * time;
  const x = p.radius! * Math.cos(angleRadians), y = p.radius! * Math.sin(angleRadians);
  const angularSpeedSquared = p.angularSpeed! ** 2, acceleration = angularSpeedSquared * p.radius!;
  const rawPeriod = TAU / Math.abs(p.angularSpeed!);
  return { time, angleRadians, x, y, vx: -p.angularSpeed! * y, vy: p.angularSpeed! * x, speed: Math.abs(p.angularSpeed!) * p.radius!, acceleration, force: p.mass! * acceleration, forceX: -p.mass! * angularSpeedSquared * x, forceY: -p.mass! * angularSpeedSquared * y, angularSpeedSquared, period: Number.isFinite(rawPeriod) ? rawPeriod : 0, periodDefined: Number.isFinite(rawPeriod) ? 1 : 0 };
}

export function calculatePrecisionLength(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('precision-length', input);
  const divisionMm = p.instrument === 0 ? .02 : .01;
  const zeroReadingMm = quantize(p.zeroErrorMm!, divisionMm);
  const readingValid = Number(p.contactMode !== 0), objectReadingValid = Number(p.contactMode === 2);
  const indicatedLengthMm = readingValid ? quantize((objectReadingValid ? p.objectLengthMm! : 0) + p.zeroErrorMm!, divisionMm) : 0;
  const correctedLengthMm = readingValid ? quantize(indicatedLengthMm - (p.zeroCorrection ? zeroReadingMm : 0), divisionMm) : 0;
  // Work in integer divisions so exact half-mm boundaries do not turn 49 into 50.
  const divisions = Math.round(indicatedLengthMm / divisionMm);
  const mainSteps = Math.floor(divisions / 50), index = divisions - mainSteps * 50;
  return { time: 0, objectLengthMm: p.objectLengthMm!, indicatedLengthMm, correctedLengthMm, zeroReadingMm, divisionMm, mainScaleMm: mainSteps * (p.instrument === 0 ? 1 : .5), vernierDivision: p.instrument === 0 ? index : 0, thimbleDivision: p.instrument === 1 ? index : 0, readingValid, objectReadingValid, contactMode: p.contactMode!, instrument: p.instrument! };
}

export function calculateResistivity(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('resistivity', input);
  const area = Math.PI * (p.diameterMm! * .001) ** 2 / 4, resistivity = p.resistivityMicroOhmM! * 1e-6;
  const resistance = resistivity * p.length! / area, current = p.voltage! / resistance;
  return { time: 0, length: p.length!, diameterMm: p.diameterMm!, area, resistivity, resistance, voltage: p.voltage!, current, power: p.voltage! * current, estimatedResistivity: current > 0 ? p.voltage! / current * area / p.length! : 0, estimateDefined: Number(current > 0) };
}

export function calculateMultimeter(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('multimeter', input);
  const ranges = [[2, 20, 200], [.002, .02, .2], [200, 2000, 20000]];
  const selectedRange = ranges[p.functionMode!]![p.rangeIndex!]!, resolution = selectedRange / 2000;
  const physicalVoltage = p.powerOn && p.circuitClosed ? p.supplyVoltage! : 0, physicalCurrent = physicalVoltage / p.resistanceOhms!;
  const configurationValid = Number(p.functionMode === 2 ? p.connection === 2 && p.powerOn === 0 : p.connection === p.functionMode);
  const sign = p.probesReversed ? -1 : 1;
  const raw = p.functionMode === 0 ? physicalVoltage * sign : p.functionMode === 1 ? physicalCurrent * sign : p.resistanceOhms!;
  const overRange = Number(configurationValid === 1 && Math.abs(raw) > selectedRange);
  const readingValid = Number(configurationValid === 1 && overRange === 0);
  return { time: 0, supplyVoltage: p.supplyVoltage!, resistanceOhms: p.resistanceOhms!, physicalVoltage, physicalCurrent, meterValue: readingValid ? quantize(raw, resolution) : 0, selectedRange, resolution, configurationValid, overRange, readingValid, functionMode: p.functionMode!, connection: p.connection!, powerOn: p.powerOn!, circuitClosed: p.circuitClosed!, probesReversed: p.probesReversed! };
}

export function calculateMomentumConservation(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('momentum-conservation', input);
  const time = boundedTime(requestedTime, 6), m1 = p.mass1!, m2 = p.mass2!, u1 = p.velocity1!, u2 = p.velocity2!;
  const approach = u1 - u2, tc = approach > 0 ? p.separation! / approach : Infinity;
  const collided = Number(tc <= time), e = p.restitution!;
  const velocity1 = collided ? (m1 * u1 + m2 * u2 - m2 * e * approach) / (m1 + m2) : u1;
  const velocity2 = collided ? (m1 * u1 + m2 * u2 + m1 * e * approach) / (m1 + m2) : u2;
  const x1 = -p.separation! / 2 + (collided ? u1 * tc + velocity1 * (time - tc) : u1 * time);
  const x2 = p.separation! / 2 + (collided ? u2 * tc + velocity2 * (time - tc) : u2 * time);
  const initialKineticEnergy = .5 * m1 * u1 ** 2 + .5 * m2 * u2 ** 2;
  const kineticEnergy = .5 * m1 * velocity1 ** 2 + .5 * m2 * velocity2 ** 2;
  return { time, x1, x2, velocity1, velocity2, totalMomentum: m1 * velocity1 + m2 * velocity2, kineticEnergy, initialKineticEnergy, energyLoss: Math.max(0, initialKineticEnergy - kineticEnergy), collisionTime: Number.isFinite(tc) ? tc : 0, collisionTimeDefined: Number(Number.isFinite(tc)), collisionPredicted: Number(approach > 0), collisionWithinWindow: Number(tc <= 6), collided };
}

export function calculateRefractiveIndex(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('refractive-index', input);
  const angle = p.incidentAngleDegrees! * degrees, sinIncident = Math.sin(angle);
  const ratio = p.incidentIndex! / p.transmittedIndex!, sine = ratio * sinIncident;
  // Roundoff at the critical angle must not fabricate total internal reflection.
  const totalInternalReflection = Number(sine > 1 + 8 * Number.EPSILON);
  const transmissionValid = 1 - totalInternalReflection, sinRefracted = transmissionValid ? Math.min(1, sine) : 0;
  const refracted = transmissionValid ? Math.asin(sinRefracted) : 0;
  const estimateDefined = Number(transmissionValid === 1 && sinIncident > 0 && sinRefracted > 0);
  return { time: 0, incidentAngleDegrees: p.incidentAngleDegrees!, refractedAngleDegrees: refracted / degrees, reflectionAngleDegrees: p.incidentAngleDegrees!, sinIncident, sinRefracted, criticalAngleDegrees: ratio > 1 ? Math.asin(1 / ratio) / degrees : 0, criticalDefined: Number(ratio > 1), totalInternalReflection, transmissionValid, readingValid: transmissionValid, indexRatioEstimate: estimateDefined ? sinIncident / sinRefracted : 0, estimateDefined, incidentDirectionX: sinIncident, incidentDirectionY: -Math.cos(angle), reflectedDirectionX: sinIncident, reflectedDirectionY: Math.cos(angle), transmittedDirectionX: sinRefracted, transmittedDirectionY: transmissionValid ? -Math.cos(refracted) : 0 };
}

export function calculateInducedCurrent(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('induced-current', input);
  const time = boundedTime(requestedTime, 4), area = p.areaCm2! * 1e-4, omega = TAU * p.rotationFrequency!;
  const angleRadians = p.phaseDegrees! * degrees + omega * time;
  const flux = p.fieldAmplitude! * area * Math.cos(angleRadians), fluxRate = -p.fieldAmplitude! * area * omega * Math.sin(angleRadians);
  const emf = -p.turns! * fluxRate;
  return { time, angleRadians, flux, fluxRate, fluxLinkage: p.turns! * flux, emf, current: p.closed ? emf / p.resistance! : 0, field: p.fieldAmplitude!, area, turns: p.turns!, resistance: p.resistance!, closed: p.closed! };
}

export function calculateTransformerRatio(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('transformer-ratio', input);
  const time = boundedTime(requestedTime, 3 / p.frequency!), turnsRatio = p.secondaryTurns! / p.primaryTurns!, readingValid = Number(p.inputMode === 0);
  const primaryRmsVoltage = p.primaryRmsVoltage!, secondaryRmsVoltage = readingValid ? turnsRatio * primaryRmsVoltage : 0;
  const secondaryCurrentRms = secondaryRmsVoltage / p.loadResistance!, secondaryPower = secondaryRmsVoltage * secondaryCurrentRms;
  return { time, primaryVoltage: readingValid ? Math.SQRT2 * primaryRmsVoltage * Math.sin(TAU * p.frequency! * time) : primaryRmsVoltage, secondaryVoltage: readingValid ? Math.SQRT2 * secondaryRmsVoltage * Math.sin(TAU * p.frequency! * time) : 0, primaryRmsVoltage, secondaryRmsVoltage, primaryCurrentRms: primaryRmsVoltage > 0 ? secondaryPower / primaryRmsVoltage : 0, secondaryCurrentRms, primaryPower: secondaryPower, secondaryPower, turnsRatio, primaryTurns: p.primaryTurns!, secondaryTurns: p.secondaryTurns!, readingValid, inputMode: p.inputMode! };
}

export function calculateSensorControl(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('sensor-control', input);
  const time = boundedTime(requestedTime, 12), upperThreshold = p.threshold! + p.hysteresis! / 2, lowerThreshold = p.threshold! - p.hysteresis! / 2;
  const sensorTemperature = p.temperatureEnd! + (p.temperatureStart! - p.temperatureEnd!) * Math.exp(-time / p.responseTime!);
  const relayAtStart = p.temperatureStart! >= upperThreshold ? 1 : p.temperatureStart! <= lowerThreshold ? 0 : p.initialRelayOn!;
  const relayOn = sensorTemperature >= upperThreshold ? 1 : sensorTemperature <= lowerThreshold ? 0 : relayAtStart;
  return { time, sensorTemperature, environmentTemperature: p.temperatureEnd!, outputVoltage: .025 * (sensorTemperature + 20), relayOn, upperThreshold, lowerThreshold };
}

export function calculateOilFilm(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('oil-film', input);
  const solutionDropVolumeMl = p.calibrationVolumeMl! / p.calibrationDrops!, pureOilVolume = solutionDropVolumeMl * p.usedDrops! * p.oilVolumeFraction! * 1e-6;
  const filmArea = p.filmAreaCm2! * 1e-4, thickness = pureOilVolume / filmArea;
  return { time: 0, solutionDropVolumeMl, pureOilVolume, filmArea, filmAreaCm2: p.filmAreaCm2!, inverseArea: 1 / filmArea, thickness, thicknessNm: thickness * 1e9 };
}

export function calculateGasPressureVolume(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('gas-pressure-volume', input);
  const amountMoles = p.amountMilliMol! * .001, volume = p.volumeMl! * 1e-6, temperatureKelvin = p.temperatureCelsius! + 273.15;
  const pressure = amountMoles * IDEAL_GAS_CONSTANT * temperatureKelvin / volume;
  return { time: 0, amountMoles, volume, volumeMl: p.volumeMl!, inverseVolume: 1 / volume, temperatureKelvin, pressure, pressureKPa: pressure / 1000, gaugePressureKPa: pressure / 1000 - p.atmosphericPressureKPa!, pV: pressure * volume };
}

export function calculateFreeFall(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('free-fall', input);
  const durationSeconds = Math.sqrt(2 * p.dropHeight! / p.gravity!), time = boundedTime(requestedTime, durationSeconds);
  const position = Math.min(p.dropHeight!, .5 * p.gravity! * time ** 2), height = p.dropHeight! - position, velocity = p.gravity! * time;
  const kineticEnergy = .5 * p.mass! * velocity ** 2, potentialEnergy = p.mass! * p.gravity! * height;
  return { time, timeSquared: time ** 2, position, height, velocity, acceleration: p.gravity!, kineticEnergy, potentialEnergy, totalEnergy: kineticEnergy + potentialEnergy, durationSeconds };
}

export function calculatePhotoelectricEffect(input: Parameters): Record<string, number> {
  const p = validatedHighSchoolParameters('photoelectric-effect', input);
  const photonEnergy = PLANCK_CONSTANT * p.frequencyTHz! * 1e12, photonEnergyEv = photonEnergy / ELEMENTARY_CHARGE;
  const maxKineticEnergyEv = Math.max(0, photonEnergyEv - p.workFunctionEv!), stoppingVoltage = maxKineticEnergyEv;
  const emissionAllowed = Number(maxKineticEnergyEv > 0), emitting = Number(emissionAllowed === 1 && p.opticalPowerMilliwatts! > 0);
  const saturationCurrent = emitting ? .1 * p.opticalPowerMilliwatts! * .001 / photonEnergy * ELEMENTARY_CHARGE : 0;
  // Additional illustrative distribution assumption, not Einstein's maximum-energy law.
  const fraction = p.collectorVoltage! >= 0 ? 1 : stoppingVoltage > 0 ? Math.max(0, 1 + p.collectorVoltage! / stoppingVoltage) : 0;
  return { time: 0, frequencyTHz: p.frequencyTHz!, collectorVoltage: p.collectorVoltage!, photonEnergyEv, thresholdFrequencyTHz: p.workFunctionEv! * ELEMENTARY_CHARGE / PLANCK_CONSTANT / 1e12, maxKineticEnergyEv, stoppingVoltage, saturationCurrent, current: saturationCurrent * fraction, emissionAllowed, emitting };
}

export function calculateChargedParticleField(input: Parameters, requestedTime = 0): Record<string, number> {
  const p = validatedHighSchoolParameters('charged-particle-field', input);
  const time = boundedTime(requestedTime, 1), speed = p.speedKmPerSecond! * 1000, chargeToMass = p.chargeToMassMillions! * 1e6, magneticField = p.magneticFieldMicrotesla! * 1e-6;
  const angularFrequency = chargeToMass * magneticField, alpha = p.initialAngleDegrees! * degrees, halfPhase = angularFrequency * time / 2;
  const sinc = Math.abs(halfPhase) < 1e-5 ? 1 - halfPhase ** 2 / 6 + halfPhase ** 4 / 120 : Math.sin(halfPhase) / halfPhase;
  const x = speed * time * sinc * Math.cos(alpha - halfPhase), y = speed * time * sinc * Math.sin(alpha - halfPhase);
  const vx = speed * Math.cos(alpha - 2 * halfPhase), vy = speed * Math.sin(alpha - 2 * halfPhase);
  const rawRadius = speed / Math.abs(angularFrequency), rawPeriod = TAU / Math.abs(angularFrequency);
  const radiusDefined = Number(Number.isFinite(rawRadius)), periodDefined = Number(Number.isFinite(rawPeriod));
  return { time, x, y, vx, vy, speed, ax: angularFrequency * vy, ay: -angularFrequency * vx, angularFrequency, radius: radiusDefined ? rawRadius : 0, radiusDefined, period: periodDefined ? rawPeriod : 0, periodDefined, centerX: radiusDefined ? speed * Math.sin(alpha) / angularFrequency : 0, centerY: radiusDefined ? -speed * Math.cos(alpha) / angularFrequency : 0, specificKineticEnergy: .5 * speed ** 2, chargeToMass, magneticField };
}
