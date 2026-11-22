import { describe, expect, it } from "vitest";
import { calculateProjectileMotion, calculateSpringForce } from "@physics-lab/physics/high-school";
import { defaultProblemParameters, evaluateProblem, parsePastedProblem, problemDefinitions } from "./problemVisualization";

describe("题目可视化与高中实验模型", () => {
  it("抛体题的初值、过程和落点使用同一计算模型", () => {
    const parameters = defaultProblemParameters("projectile");
    const expected = calculateProjectileMotion({ initialSpeed: 8, angleDegrees: 0, initialHeight: 2 }, 0);
    const start = evaluateProblem("projectile", parameters, 0);
    const landing = evaluateProblem("projectile", parameters, start.flightTime);
    expect(start.flightTime).toBeCloseTo(expected.flightTime, 12);
    expect(start.range).toBeCloseTo(8 * Math.sqrt(4 / 9.8), 12);
    expect(landing.x).toBeCloseTo(start.range, 12);
    expect(landing.y).toBeCloseTo(0, 12);
  });

  it("弹簧题的读数遵守静态平衡与线性范围", () => {
    const parameters = defaultProblemParameters("spring");
    const state = evaluateProblem("spring", parameters);
    const expected = calculateSpringForce({ stiffness: 20, naturalLength: .15, loadMassGrams: 100 });
    expect(state).toEqual(expected);
    expect(state.force).toBeCloseTo(.98, 12);
    expect(state.extension).toBeCloseTo(.049, 12);
    expect(state.length).toBeCloseTo(.199, 12);
    expect(problemDefinitions.spring.parameters.find((item) => item.key === "loadMassGrams")?.max).toBe(250);
  });

  it("从粘贴的平抛题中读取数值并生成对应模型参数", () => {
    const result = parsePastedProblem("小球从高为2m的平台以8m/s的速度平抛，忽略空气阻力，求落地时间和水平射程。 ");
    expect(result).toEqual({ status: "matched", kind: "projectile", parameters: { initialSpeed: 8, angleDegrees: 0, initialHeight: 2 }, original: "小球从高为2m的平台以8m/s的速度平抛，忽略空气阻力，求落地时间和水平射程。" });
  });

  it("换算弹簧题中的厘米和千克，并拒绝缺失或超范围条件", () => {
    const result = parsePastedProblem("一根弹簧原长15cm，劲度系数为20N/m，挂上质量为0.1kg的物体，求静止时伸长量。 ");
    expect(result).toEqual({ status: "matched", kind: "spring", parameters: { stiffness: 20, naturalLength: .15, loadMassGrams: 100 }, original: "一根弹簧原长15cm，劲度系数为20N/m，挂上质量为0.1kg的物体，求静止时伸长量。" });
    expect(parsePastedProblem("平抛运动求射程")).toMatchObject({ status: "unsupported" });
    expect(parsePastedProblem("弹簧原长15cm，劲度系数为20N/m，挂上质量为1kg的物体")).toMatchObject({ status: "unsupported" });
    expect(parsePastedProblem("弹簧原长15cm，劲度系数为20N/m，挂上质量为0.1kg的物体，求振动周期")).toMatchObject({ status: "unsupported" });
    expect(parsePastedProblem("小球从高为2m的平台以8m/s的速度平抛，考虑空气阻力，求射程")).toMatchObject({ status: "unsupported" });
    expect(parsePastedProblem("电磁感应中磁通量变化时电流方向如何？")).toMatchObject({ status: "unsupported" });
  });
});
