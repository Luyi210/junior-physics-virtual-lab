import { calculateProjectileMotion, calculateSpringForce, highSchoolExperiment } from "@physics-lab/physics/high-school";

export type ProblemKind = "projectile" | "spring";

export const problemCases = {
  projectile: {
    number: "01",
    field: "运动学 / 抛体运动",
    title: "球从平台飞出后，会落在哪里？",
    question: "一个小球从高于水平地面的平台抛出。已知初速度大小、抛射角和初始高度，忽略空气阻力，求落地时间与水平射程。",
    experimentId: "projectile-motion",
    parameters: ["initialSpeed", "angleDegrees", "initialHeight"]
  },
  spring: {
    number: "02",
    field: "力学 / 胡克定律",
    title: "挂上砝码，弹簧伸长多少？",
    question: "一根轻弹簧竖直悬挂，原长和劲度系数已知。挂上总质量已知的重物并静止后，求弹簧受到的拉力与伸长量。",
    experimentId: "spring-force",
    parameters: ["stiffness", "naturalLength", "loadMassGrams"]
  }
} as const;

export const problemDefinitions = {
  projectile: highSchoolExperiment("projectile-motion"),
  spring: highSchoolExperiment("spring-force")
};

export function defaultProblemParameters(kind: ProblemKind): Record<string, number> {
  return Object.fromEntries(problemDefinitions[kind].parameters.map((item) => [item.key, item.defaultValue]));
}

export function evaluateProblem(kind: "projectile", parameters: Record<string, number>, time: number): ReturnType<typeof calculateProjectileMotion>;
export function evaluateProblem(kind: "spring", parameters: Record<string, number>, time?: number): ReturnType<typeof calculateSpringForce>;
export function evaluateProblem(kind: ProblemKind, parameters: Record<string, number>, time = 0) {
  if (kind === "projectile") return calculateProjectileMotion({
    initialSpeed: parameters.initialSpeed!, angleDegrees: parameters.angleDegrees!, initialHeight: parameters.initialHeight!
  }, time);
  return calculateSpringForce({
    stiffness: parameters.stiffness!, naturalLength: parameters.naturalLength!, loadMassGrams: parameters.loadMassGrams!
  });
}

export function formatQuantity(value: number, digits = 2): string {
  return value.toFixed(digits).replace(/\.0+$/u, "").replace(/(\.\d*?)0+$/u, "$1");
}

export type ParsedProblem =
  | { status: "matched"; kind: ProblemKind; parameters: Record<string, number>; original: string }
  | { status: "unsupported"; message: string };

const NUMBER = "(\\d+(?:\\.\\d+)?)";
function amount(text: string, pattern: RegExp): { value: number; unit: string } | null {
  const match = text.match(pattern);
  return match ? { value: Number(match[1]), unit: match[2] ?? "" } : null;
}

function checkRanges(kind: ProblemKind, values: Record<string, number>): string | null {
  for (const parameter of problemDefinitions[kind].parameters) {
    const value = values[parameter.key];
    if (value === undefined || !Number.isFinite(value) || value < parameter.min || value > parameter.max) {
      return `${parameter.label}需在 ${formatQuantity(parameter.min)}–${formatQuantity(parameter.max)} ${parameter.unit} 之间。`;
    }
  }
  return null;
}

export function parsePastedProblem(raw: string): ParsedProblem {
  const original = raw.trim();
  if (!original) return { status: "unsupported", message: "请先粘贴题目文字。" };
  const text = original.normalize("NFKC").replace(/米每秒|米\/秒/gu, "m/s").replace(/牛每米|牛\/米/gu, "N/m").replace(/千克/gu, "kg").replace(/厘米/gu, "cm").replace(/克/gu, "g");
  const springQuestion = /弹簧|劲度系数|胡克定律/u.test(text);
  const projectileQuestion = /平抛|斜抛|抛射|抛出|水平射程|飞出|落地/u.test(text);
  if (springQuestion && projectileQuestion) return { status: "unsupported", message: "题目同时涉及多个模型。请先截取一道只含抛体或弹簧条件的小题。" };
  if (projectileQuestion) {
    if (/考虑空气阻力|不忽略空气阻力|计入空气阻力|斜面落地|斜坡落地/u.test(text)) return { status: "unsupported", message: "当前抛体场景只适用于忽略空气阻力、水平地面的题目。" };
    const speed = amount(text, new RegExp(`(?:初速(?:度)?(?:大小)?|水平速度|速度|以)\\s*(?:为|是|约|大小为|=)?\\s*${NUMBER}\\s*(m\\/s)`, "u"));
    const height = amount(text, new RegExp(`(?:初始高度|离地(?:面)?高度|平台高度|高度|距地(?:面)?|离地(?:面)?|高)\\s*(?:为|是|约|=)?\\s*${NUMBER}\\s*(m|cm)`, "u"))
      ?? amount(text, new RegExp(`(?:从|在)\\s*${NUMBER}\\s*(m|cm)\\s*高`, "u"));
    const angle = amount(text, new RegExp(`(?:抛射角|仰角|与水平(?:方向)?(?:成|夹角))\\s*(?:为|是|约|=)?\\s*${NUMBER}\\s*(°|度)`, "u"))
      ?? amount(text, new RegExp(`${NUMBER}\\s*(°|度)\\s*(?:角)?\\s*(?:斜向)?抛`, "u"));
    const missing = [!speed && "初速度（m/s）", !height && "离地高度（m 或 cm）", !/平抛/u.test(text) && !angle && "抛射角（°）"].filter(Boolean);
    if (missing.length) return { status: "unsupported", message: `已识别为抛体题，还缺少：${missing.join("、")}。请补全题干后再生成。` };
    const parameters = { initialSpeed: speed!.value, angleDegrees: /平抛/u.test(text) ? 0 : angle!.value, initialHeight: height!.unit === "cm" ? height!.value / 100 : height!.value };
    const outOfRange = checkRanges("projectile", parameters);
    return outOfRange ? { status: "unsupported", message: outOfRange } : { status: "matched", kind: "projectile", parameters, original };
  }
  if (springQuestion) {
    if (/振子|振动|简谐|周期|弹性势能|释放后运动|加速运动/u.test(text)) return { status: "unsupported", message: "当前弹簧场景只计算静态平衡，暂不模拟弹簧振子或运动过程。" };
    const stiffness = amount(text, new RegExp(`(?:劲度系数|弹簧系数|k)\\s*(?:为|是|约|=)?\\s*${NUMBER}\\s*(N\\/m)`, "iu"));
    const naturalLength = amount(text, new RegExp(`(?:弹簧原长|自然长度|原长)\\s*(?:为|是|约|=)?\\s*${NUMBER}\\s*(m|cm)`, "u"));
    const mass = amount(text, new RegExp(`(?:悬挂(?:物|砝码)?(?:总)?质量|总质量|砝码质量|物体质量|质量|挂上)\\s*(?:为|是|约|=|了)?\\s*${NUMBER}\\s*(g|kg)`, "u"));
    const missing = [!stiffness && "劲度系数（N/m）", !naturalLength && "原长（m 或 cm）", !mass && "悬挂总质量（g 或 kg）"].filter(Boolean);
    if (missing.length) return { status: "unsupported", message: `已识别为弹簧题，还缺少：${missing.join("、")}。请补全题干后再生成。` };
    const parameters = { stiffness: stiffness!.value, naturalLength: naturalLength!.unit === "cm" ? naturalLength!.value / 100 : naturalLength!.value, loadMassGrams: mass!.unit === "kg" ? mass!.value * 1000 : mass!.value };
    const outOfRange = checkRanges("spring", parameters);
    return outOfRange ? { status: "unsupported", message: outOfRange } : { status: "matched", kind: "spring", parameters, original };
  }
  return { status: "unsupported", message: "目前还不能可靠地把这道题转换为定量场景。先支持抛体运动和弹簧静态平衡；可以选择下方示例体验。" };
}
