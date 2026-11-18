

export type CircuitTopology = "series" | "parallel";

export interface TwoLoadCircuitState {
  totalCurrent: number;
  equivalentResistance: number;
  branchCurrents: [number, number];
  loadVoltages: [number, number];
  loadPowers: [number, number];
  energized: boolean;
}

export function calculateTwoLoadCircuit(
  topology: CircuitTopology,
  voltage: number,
  r1: number,
  r2: number,
  closed = true,
  load1Connected = true,
  load2Connected = true
): TwoLoadCircuitState {
  if (![voltage, r1, r2].every(Number.isFinite) || voltage < 0 || r1 <= 0 || r2 <= 0) throw new RangeError("电压与电阻必须有限，电压不能为负，电阻必须大于零");
  if (topology !== "series" && topology !== "parallel") throw new RangeError("电路必须为串联或并联");

  if (!closed) {
    return {
      totalCurrent: 0,
      equivalentResistance: Infinity,
      branchCurrents: [0, 0],
      loadVoltages: [0, 0],
      loadPowers: [0, 0],
      energized: false
    };
  }

  if (topology === "series") {
    const current = load1Connected && load2Connected ? voltage / (r1 + r2) : 0;
    return {
      totalCurrent: current,
      equivalentResistance: load1Connected && load2Connected ? r1 + r2 : Infinity,
      branchCurrents: [current, current],
      loadVoltages: [current * r1, current * r2],
      loadPowers: [current * current * r1, current * current * r2],
      energized: current > 0
    };
  }

  const current1 = load1Connected ? voltage / r1 : 0;
  const current2 = load2Connected ? voltage / r2 : 0;
  const totalCurrent = current1 + current2;
  const conductance = (load1Connected ? 1 / r1 : 0) + (load2Connected ? 1 / r2 : 0);
  return {
    totalCurrent,
    equivalentResistance: conductance > 0 ? 1 / conductance : Infinity,
    branchCurrents: [current1, current2],
    loadVoltages: [load1Connected ? voltage : 0, load2Connected ? voltage : 0],
    loadPowers: [current1 * current1 * r1, current2 * current2 * r2],
    energized: totalCurrent > 0
  };
}

export function calculateCircuit(topology: CircuitTopology, voltage: number, r1: number, r2: number, closed = true) {
  if (voltage < 0 || r1 <= 0 || r2 <= 0) throw new RangeError("电压不能为负，电阻必须大于零");
  const totalResistance = topology === "series" ? r1 + r2 : 1 / (1 / r1 + 1 / r2);
  const totalCurrent = closed ? voltage / totalResistance : 0;
  return { totalResistance, totalCurrent, totalPower: voltage * totalCurrent };
}

export function calculateProtectedShortCircuit(
  sourceVoltage: number,
  sourceInternalResistance = .8,
  fuseRatingAmps = 5
) {
  if (sourceVoltage <= 0 || sourceInternalResistance <= 0 || fuseRatingAmps <= 0) throw new RangeError("电源电压、内阻和熔断额定电流必须大于零");
  const prospectiveCurrent = sourceVoltage / sourceInternalResistance;
  const fuseTrips = prospectiveCurrent > fuseRatingAmps;
  const overloadMultiple = prospectiveCurrent / fuseRatingAmps;
  return { prospectiveCurrent, fuseTrips, overloadMultiple };
}

export function calculateElectromagnetExperiment(
  turns: number,
  currentAmps: number,
  hasIronCore: boolean,
  poweredSeconds: number
) {
  if (turns <= 0) throw new RangeError("线圈匝数必须大于零");
  if (currentAmps < 0 || poweredSeconds < 0) throw new RangeError("电流和通电时间不能为负");
  const coreFactor = hasIronCore ? 1 : 0.18;
  const strengthIndex = turns * currentAmps * coreFactor / 100;
  // Fixed classroom nail batch: pickup count is a reproducible teaching proxy, not magnetic flux density.
  const pickedNails = currentAmps > 0 ? Math.max(0, Math.min(12, Math.floor(strengthIndex * 4))) : 0;
  // Relative coil heating model based on the I²Rt trend under a fixed coil construction.
  const temperatureRise = currentAmps * currentAmps * poweredSeconds * 0.18;
  return { strengthIndex, pickedNails, temperatureRise, overheatRisk: temperatureRise >= 8 };
}

export type ElectromagnetCurrentDirection = "forward" | "reverse";

/** Fixed winding direction: reversing the power leads reverses the current and swaps both magnetic poles. */
export function calculateElectromagnetPolarity(currentDirection: ElectromagnetCurrentDirection) {
  if (currentDirection !== "forward" && currentDirection !== "reverse") throw new RangeError("电流方向必须为正接或反接");
  const rightPole = currentDirection === "forward" ? "N" : "S";
  const leftPole = rightPole === "N" ? "S" : "N";
  // The compass is placed just to the right of the solenoid. Its north end points away from N and toward S.
  const compassNorthDirection = rightPole === "N" ? "right" : "left";
  return { leftPole, rightPole, compassNorthDirection } as const;
}

export function calculateAppliancePower(
  ratedVoltage: number,
  ratedPower: number,
  actualVoltage: number,
  operatingSeconds: number
) {
  if (ratedVoltage <= 0 || ratedPower <= 0) throw new RangeError("额定电压和额定功率必须大于零");
  if (actualVoltage < 0 || operatingSeconds < 0) throw new RangeError("实际电压和工作时间不能为负");
  // Treat the appliance as a fixed resistance derived from its nameplate for this junior-high teaching model.
  const resistance = ratedVoltage * ratedVoltage / ratedPower;
  const current = actualVoltage / resistance;
  const actualPower = actualVoltage * current;
  const energyJoules = actualPower * operatingSeconds;
  const energyKilowattHours = energyJoules / 3_600_000;
  const voltageRatio = actualVoltage / ratedVoltage;
  const operatingState = voltageRatio > 1.1 ? "overvoltage" as const : voltageRatio < .9 ? "undervoltage" as const : "normal" as const;
  return { resistance, current, actualPower, energyJoules, energyKilowattHours, voltageRatio, operatingState };
}
