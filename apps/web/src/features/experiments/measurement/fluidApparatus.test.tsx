import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuoyancyApparatus, BuoyancyLab } from "../mechanics/BuoyancyLab";
import { buoyancyGeometry } from "../mechanics/buoyancyGeometry";
import { DensityCylinder, DensityLab } from "./DensityLab";
import { densityGeometry } from "./densityGeometry";

describe("fluid apparatus rendering", () => {
  it("renders the quarter-submerged specimen and force readout within one scalable coordinate system", () => {
    const html = renderToStaticMarkup(<BuoyancyApparatus geometry={buoyancyGeometry({ objectVolumeCm3: 100, immersionPercent: 25, touchingBottom: false })} objectLabel="铝块" objectColor="#9ba8ad" liquidLabel="水" liquidColor="#50b2d9" liquidDensity={1} gravity={2.7} buoyancy={0.25} support={0} reading={2.45} />);
    expect(html).toContain('viewBox="0 0 600 630"');
    expect(html).toContain('data-displaced-volume="25"');
    expect(html).toContain("浸入 25%，排开液体 25 cm³");
    expect(html).toContain("测力计示数 2.45 N");
    expect(html).toContain("箭长不表示大小");
    expect(html).not.toContain('class="buoyancy-object"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("draws the 70 mL water level and scale tick at the same coordinate", () => {
    const html = renderToStaticMarkup(<DensityCylinder geometry={densityGeometry({ waterAdded: true, sampleVolumeCm3: 20, immersed: true, condition: "correct" })} sampleName="铝块" sampleColor="#9ba8ad" eyePosition="level" visibleVolume={70} />);
    expect(html).toContain('viewBox="0 0 180 400"');
    expect(html).toContain('data-volume-ml="70"');
    expect(html).toContain('d="M32 135Q38 140 48 140H110Q120 140 126 135');
    expect(html).toContain('data-tick-ml="70"><path d="M107 140H126"');
    expect(html).toContain("完全浸没且不接触筒底");
    expect(html).toContain("平视凹液面最低处");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("describes partial immersion separately from full immersion with bubbles", () => {
    const render = (condition: "partial" | "bubbles") => renderToStaticMarkup(<DensityCylinder geometry={densityGeometry({ waterAdded: true, sampleVolumeCm3: 20, immersed: true, condition })} sampleName="铝块" eyePosition="level" visibleVolume={condition === "partial" ? 68 : 72} />);
    expect(render("partial")).toContain("部分浸没，露出 2 cm³");
    expect(render("partial")).not.toContain("完全浸没且不接触筒底");
    expect(render("bubbles")).toContain("完全浸没且不接触筒底，附着气泡另排开 2 mL 水");
  });

  it("keeps existing measurement steps and explains the equal-cross-section schematic", () => {
    const buoyancy = renderToStaticMarkup(<BuoyancyLab />);
    const density = renderToStaticMarkup(<DensityLab />);
    expect(buoyancy).toContain("物体还受到悬线拉力");
    expect(buoyancy).toContain("锁存 F′");
    expect(density).toContain("等截面样品示意");
    expect(density).toContain("正式体积用锁存的 V₂−V₁ 得到");
    expect(density).toContain("空量筒");
    expect(density).not.toContain('class="density-graduated-cylinder"');
  });
});
