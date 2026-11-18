export interface LensInput {
  focalLength: number;
  lensX: number;
  objectX: number;
  objectHeight: number;
  screenX: number;
}

export type LensCase = "far" | "twice" | "between" | "focus" | "virtual";

export interface LensResult {
  objectDistance: number;
  imageDistance: number;
  imageX: number;
  magnification: number;
  imageHeight: number;
  finite: boolean;
  real: boolean;
  screenFocused: boolean;
  screenError: number;
  case: LensCase;
  nature: string;
  conclusion: string;
}

// Numerical equality only: instrument/readout tolerances must not turn a
// physically enlarged or reduced image into an exactly equal-sized image.
const sameDistance = (a: number, b: number) => Math.abs(a - b) <= 16 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));

export function calculateLens(input: LensInput): LensResult {
  const objectDistance = input.lensX - input.objectX;

  if (input.focalLength <= 0) {
    throw new RangeError("焦距必须大于 0");
  }
  if (objectDistance <= 0) {
    throw new RangeError("物体必须位于透镜左侧");
  }

  if (sameDistance(objectDistance, input.focalLength)) {
    return {
      objectDistance,
      imageDistance: Number.POSITIVE_INFINITY,
      imageX: Number.POSITIVE_INFINITY,
      magnification: Number.NEGATIVE_INFINITY,
      imageHeight: Number.NEGATIVE_INFINITY,
      finite: false,
      real: false,
      screenFocused: false,
      screenError: Number.POSITIVE_INFINITY,
      case: "focus",
      nature: "不成有限清晰像",
      conclusion: "物体位于焦点，折射光线平行射出，不能在有限距离形成清晰像。"
    };
  }

  const imageDistance = input.focalLength * objectDistance / (objectDistance - input.focalLength);
  const magnification = -imageDistance / objectDistance;
  const imageHeight = input.objectHeight * magnification;
  const imageX = input.lensX + imageDistance;
  const real = imageDistance > 0;
  const screenError = real ? Math.abs(input.screenX - imageX) : Number.POSITIVE_INFINITY;
  const screenFocused = real && screenError <= 1;

  let lensCase: LensCase;
  let conclusion: string;
  if (sameDistance(objectDistance, 2 * input.focalLength)) {
    lensCase = "twice";
    conclusion = "物体位于二倍焦距，形成倒立、等大的实像。";
  } else if (objectDistance > 2 * input.focalLength) {
    lensCase = "far";
    conclusion = "物距大于二倍焦距，形成倒立、缩小的实像。";
  } else if (objectDistance > input.focalLength) {
    lensCase = "between";
    conclusion = "物距位于一倍与二倍焦距之间，形成倒立、放大的实像。";
  } else {
    lensCase = "virtual";
    conclusion = "物距小于焦距，形成正立、放大的虚像，光屏不能承接。";
  }

  const size = lensCase === "twice" ? "等大" : Math.abs(magnification) > 1 ? "放大" : "缩小";
  const nature = `${magnification < 0 ? "倒立" : "正立"}、${size}、${real ? "实像" : "虚像"}`;

  return {
    objectDistance,
    imageDistance,
    imageX,
    magnification,
    imageHeight,
    finite: true,
    real,
    screenFocused,
    screenError,
    case: lensCase,
    nature,
    conclusion
  };
}
