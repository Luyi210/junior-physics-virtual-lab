

export function calculateReflection(incidenceAngle: number) {
  if (!Number.isFinite(incidenceAngle) || incidenceAngle < 0 || incidenceAngle >= 90) throw new RangeError("入射角应在 0° 到 90° 之间");
  return { incidenceAngle, reflectionAngle: incidenceAngle };
}

export function calculateRefraction(incidenceAngle: number, incidentIndex: number, refractedIndex: number) {
  if (!Number.isFinite(incidenceAngle) || incidenceAngle < 0 || incidenceAngle >= 90) throw new RangeError("入射角应在 0° 到 90° 之间");
  if (!Number.isFinite(incidentIndex) || !Number.isFinite(refractedIndex) || incidentIndex <= 0 || refractedIndex <= 0) throw new RangeError("介质折射率必须大于零");

  const incidenceRadians = incidenceAngle * Math.PI / 180;
  const sineOfRefraction = incidentIndex * Math.sin(incidenceRadians) / refractedIndex;
  if (sineOfRefraction > 1 + 1e-12) {
    return { incidenceAngle, refractionAngle: null, totalInternalReflection: true };
  }

  return {
    incidenceAngle,
    refractionAngle: Math.asin(Math.max(-1, Math.min(1, sineOfRefraction))) * 180 / Math.PI,
    totalInternalReflection: false
  };
}

export type SphericalMirrorType = "concave" | "convex";

export function calculateSphericalMirror(type: SphericalMirrorType, objectDistance: number, focalLength = 120) {
  if (objectDistance <= 0 || focalLength <= 0) throw new RangeError("物距和焦距必须大于零");
  const signedFocalLength = type === "concave" ? focalLength : -focalLength;
  const atFocus = type === "concave" && Math.abs(objectDistance - focalLength) < 1e-9;
  if (atFocus) {
    return { atFocus: true, imageDistance: Infinity, magnification: Infinity, real: false, nature: "反射光近似平行，像在无穷远" };
  }

  const imageDistance = signedFocalLength * objectDistance / (objectDistance - signedFocalLength);
  const magnification = -imageDistance / objectDistance;
  const real = imageDistance > 0;
  const nature = type === "convex"
    ? "正立、缩小的虚像，视野更大"
    : real
      ? Math.abs(magnification) > 1.05
        ? "倒立、放大的实像"
        : Math.abs(magnification) < .95
          ? "倒立、缩小的实像"
          : "倒立、等大的实像"
      : "正立、放大的虚像";

  return { atFocus: false, imageDistance, magnification, real, nature };
}
