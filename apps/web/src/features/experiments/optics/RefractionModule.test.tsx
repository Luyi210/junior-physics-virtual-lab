import { renderToStaticMarkup } from "react-dom/server";
import { calculateRefraction } from "@physics-lab/physics";
import { describe, expect, it } from "vitest";
import { RefractionReadout } from "./RefractionModule";
import { RefractionDiagram2D, ReflectionDiagram2D } from "./components/OpticsLawDiagram2D";
import { RefractionScene3D } from "./components/OpticsLawScene3D";
import { RangeControl } from "./shared/OpticsControls";
import { LawPresets } from "./shared/LawControls";
import { formatOpticsAngle } from "./shared/formatOpticsAngle";

function readout(angle: number, n1: number, n2: number, interacted = true) {
  return renderToStaticMarkup(<RefractionReadout result={calculateRefraction(angle, n1, n2)} interacted={interacted} />);
}

describe("refraction observations follow the actual propagation direction", () => {
  it.each([[1, 1.33], [1, 1.52], [1.33, 1]])("normal incidence from n=%s to n=%s does not bend", (n1, n2) => {
    const html = readout(0, n1, n2);
    expect(html).toContain("垂直入射，传播方向不偏折");
    expect(html).toContain("折射角 0.0°");
    expect(html).not.toContain("远离法线"); expect(html).not.toContain("向法线偏折");
  });

  it("oblique incidence bends toward the normal on entry and away on exit", () => {
    expect(readout(40, 1, 1.33)).toContain("折射光向法线偏折");
    expect(readout(40, 1.33, 1)).toContain("折射光远离法线偏折");
    expect(readout(40, 1.33, 1.33)).toContain("传播方向不偏折");
  });

  it("distinguishes the critical ray along the interface from total internal reflection above it", () => {
    const critical = Math.asin(1 / 1.33) * 180 / Math.PI;
    expect(readout(critical, 1.33, 1)).toContain("临界状态：折射方向沿分界面，折射角为90°");
    expect(readout(critical, 1.33, 1)).not.toContain("折射光消失");
    const total = readout(critical + 0.1, 1.33, 1);
    expect(total).toContain("折射光消失，发生全反射");
    expect(total).not.toContain("折射角为90°");
  });

  it("the standby view asks for observation without claiming that a measurement was made", () => {
    const html = readout(0, 1, 1.33, false);
    expect(html).toContain("垂直入射时，传播方向是否改变？");
    expect(html).not.toContain("垂直入射，传播方向不偏折");
    expect(html).not.toContain("折射角 0.0°");
  });
});

describe("critical-angle display remains consistent across refraction views", () => {
  const critical = Math.asin(1 / 1.33) * 180 / Math.PI;
  const props = (angle: number) => ({ angle, ...calculateRefraction(angle, 1.33, 1), topMedium: "水", bottomMedium: "空气", interacted: true });

  it("shows the exact preset as an explicitly rounded input in the readout, 2D labels and 3D badges", () => {
    const state = props(critical);
    const html = [readout(critical, 1.33, 1), renderToStaticMarkup(<RefractionDiagram2D {...state} />), renderToStaticMarkup(<RefractionScene3D {...state} />)];
    for (const view of html) {
      expect(view).toContain("≈48.7535");
      expect(view).toContain("90.0°");
      expect(view).not.toContain("49°");
      expect(view).not.toContain("= ≈");
      expect(view).not.toContain("发生全反射");
    }
    expect(state.angle).toBe(critical);
    expect(state.refractionAngle).toBe(90);
  });

  it.each([
    [critical - .0001, false], [critical, false], [critical + .0001, true], [48.8, true], [49, true]
  ] as const)("uses the unrounded model at %s degrees (TIR=%s)", (angle, total) => {
    const state = props(angle);
    expect(state.totalInternalReflection).toBe(total);
    const readoutHtml = readout(angle, 1.33, 1);
    const diagram = renderToStaticMarkup(<RefractionDiagram2D {...state} />);
    const scene = renderToStaticMarkup(<RefractionScene3D {...state} />);
    expect(readoutHtml.includes("折射光消失，发生全反射")).toBe(total);
    expect(diagram.includes("全反射光")).toBe(total);
    expect(scene.includes("发生全反射")).toBe(total);
    if (angle === 48.8) {
      expect(diagram).toContain("48.8"); expect(scene).toContain("入射角 48.8°");
      expect(diagram).not.toContain("≈48.8");
    }
  });

  it("formats the slider output and accessible value without rounding its model input", () => {
    const html = renderToStaticMarkup(<RangeControl label="入射角 α" value={critical} min={0} max={78} step={1} unit="°" formatValue={formatOpticsAngle} onChange={() => {}} />);
    expect(html).toContain('<output aria-live="polite">≈48.7535 °</output>');
    expect(html).toContain('aria-valuetext="≈48.7535 °"');
    expect(html).toContain(`value="${critical}"`);
  });

  it.each([critical - .0001, critical, 48.8, 49])("does not mark the critical preset for a merely nearby angle %s", (angle) => {
    const html = renderToStaticMarkup(<LawPresets label="寻找临界角" activeValue={angle} activeTolerance={1e-9} options={[{ label: "临界状态", value: critical }]} onSelect={() => {}} />);
    expect(html).toContain(`aria-pressed="${angle === critical}"`);
  });

  it("keeps reflection integer labels and shared control/preset defaults unchanged", () => {
    const reflection = renderToStaticMarkup(<ReflectionDiagram2D angle={40} roughness={0} interacted />);
    expect(reflection).toContain("入射角 i = 40°"); expect(reflection).toContain("反射角 r = 40°");
    expect(reflection).not.toContain("≈");
    const control = renderToStaticMarkup(<RangeControl label="反射入射角" value={40} min={0} max={78} step={1} unit="°" onChange={() => {}} />);
    expect(control).toContain('<output aria-live="polite">40 °</output>');
    const preset = renderToStaticMarkup(<LawPresets label="反射" activeValue={40.05} options={[{ label: "40°", value: 40 }]} onSelect={() => {}} />);
    expect(preset).toContain('aria-pressed="true"');
  });
});
