

export function calculateLever(leftForce: number, leftArm: number, rightForce: number, rightArm: number) {
  const leftMoment = leftForce * leftArm;
  const rightMoment = rightForce * rightArm;
  const difference = rightMoment - leftMoment;
  return { leftMoment, rightMoment, difference, balanced: Math.abs(difference) < 0.05 };
}

/**
 * Turning effect of an oblique force. The lever arm is the perpendicular
 * distance from the pivot to the force's line of action, not the rod length.
 */
export function calculateLeverForceLine(force: number, pivotDistance: number, forceAngleDegrees: number) {
  if (force < 0 || pivotDistance <= 0 || forceAngleDegrees < 0 || forceAngleDegrees > 180) {
    throw new RangeError("力不能为负，悬点距离必须大于零，夹角应在0～180°之间");
  }
  const angleRadians = forceAngleDegrees * Math.PI / 180;
  const perpendicularArm = pivotDistance * Math.abs(Math.sin(angleRadians));
  return { perpendicularArm, moment: force * perpendicularArm };
}

export function calculateInclinedCartRun(
  trackLengthMeters: number,
  verticalHeightMeters: number,
  rollingFactor = 0.72,
  gravity = 10
) {
  if (![trackLengthMeters, verticalHeightMeters, rollingFactor, gravity].every(Number.isFinite)) throw new RangeError("斜轨参数必须是有限数值");
  if (trackLengthMeters <= 0) throw new RangeError("轨道路程必须大于零");
  if (verticalHeightMeters <= 0 || verticalHeightMeters >= trackLengthMeters) throw new RangeError("轨道高度应大于零且小于轨道路程");
  if (rollingFactor <= 0 || rollingFactor > 1) throw new RangeError("滚动修正系数应大于0且不超过1");
  if (gravity <= 0) throw new RangeError("重力加速度必须大于零");
  const acceleration = gravity * verticalHeightMeters / trackLengthMeters * rollingFactor;
  const timeSeconds = Math.sqrt(2 * trackLengthMeters / acceleration);
  const averageSpeed = trackLengthMeters / timeSeconds;
  const finalSpeed = acceleration * timeSeconds;
  return { acceleration, timeSeconds, averageSpeed, finalSpeed };
}

/** The cart starts at rest at the first gate. Timer and diagram share this state. */
export function calculateInclinedCartState(trackLengthMeters: number, verticalHeightMeters: number, elapsedSeconds: number, rollingFactor = 0.72, gravity = 10) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError("实验时间必须是非负有限数值");
  const run = calculateInclinedCartRun(trackLengthMeters, verticalHeightMeters, rollingFactor, gravity);
  const timeSeconds = Math.min(elapsedSeconds, run.timeSeconds);
  const finished = elapsedSeconds >= run.timeSeconds;
  const distanceMeters = finished ? trackLengthMeters : .5 * run.acceleration * timeSeconds ** 2;
  return { timeSeconds, distanceMeters, instantaneousSpeed: run.acceleration * timeSeconds, progress: distanceMeters / trackLengthMeters, finished };
}

export function calculateFrictionRegime(
  normalForceNewtons: number,
  kineticCoefficient: number,
  pullForceNewtons: number,
  alreadySliding: boolean,
  staticToKineticRatio = 1.25
) {
  if (![normalForceNewtons, kineticCoefficient, pullForceNewtons, staticToKineticRatio].every(Number.isFinite)) throw new RangeError("摩擦实验参数必须是有限数值");
  if (normalForceNewtons <= 0) throw new RangeError("压力必须大于零");
  if (kineticCoefficient < 0 || pullForceNewtons < 0) throw new RangeError("摩擦系数和拉力不能为负");
  if (staticToKineticRatio < 1) throw new RangeError("最大静摩擦力不应小于滑动摩擦力");
  const kineticFriction = normalForceNewtons * kineticCoefficient;
  const maximumStaticFriction = kineticFriction * staticToKineticRatio;
  const startsSliding = alreadySliding || pullForceNewtons > maximumStaticFriction;
  const frictionForce = startsSliding ? kineticFriction : Math.min(pullForceNewtons, maximumStaticFriction);
  const forceTolerance = 1e-10 * Math.max(1, pullForceNewtons, kineticFriction);
  const accelerationTrend = !startsSliding ? "stationary" as const : Math.abs(pullForceNewtons - kineticFriction) <= forceTolerance ? "uniform" as const : pullForceNewtons > kineticFriction ? "accelerating" as const : "slowing" as const;
  return { kineticFriction, maximumStaticFriction, frictionForce, startsSliding, accelerationTrend };
}

export function calculateSolidPressure(forceNewtons: number, areaSquareCentimeters: number) {
  if (forceNewtons < 0) throw new RangeError("压力不能为负");
  if (areaSquareCentimeters <= 0) throw new RangeError("受力面积必须大于零");
  const areaSquareMeters = areaSquareCentimeters / 10000;
  const pressurePascals = forceNewtons / areaSquareMeters;
  // Relative indentation for one fixed foam pad; used only as a comparison cue.
  const indentationMillimeters = Math.min(18, pressurePascals / 2500);
  return { areaSquareMeters, pressurePascals, indentationMillimeters };
}
