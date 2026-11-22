import { describe, expect, it } from "vitest";
import { isLiliReflectionRequest, reviewLiliReflection } from "./liliReflection";

describe("Lili local reflection coaching", () => {
  it("checks a high-school observation's structure without certifying its numbers", () => {
    const result = reviewLiliReflection("检查这条观察：保持高度不变，把初速度从 5 m/s 调到 8 m/s；我观察到射程从 2 m 变为 3 m。");
    expect(result?.text).toContain("4/4 项");
    expect(result?.text).toContain("没有核实你写的数值或操作");
    expect(isLiliReflectionRequest("检查这条观察：初速度改变了")).toBe(true);
  });

  it("flags missing evidence and absolute conclusions without inventing a measurement", () => {
    expect(reviewLiliReflection("检查这条结论：所有物体一定下落得一样快。")?.text).toContain("超出当前证据范围");
    expect(reviewLiliReflection("检查这条假设：")?.text).toContain("请在");
    expect(reviewLiliReflection("为什么会下落？")).toBeNull();
  });
});
