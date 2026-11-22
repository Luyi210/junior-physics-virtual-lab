import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculateDoubleSlitBrightPosition, defaultHighSchoolParameters, simulateHighSchoolExperiment, type DoubleSlitParameters } from "@physics-lab/physics/high-school";
import { ExperimentDiagram2D } from "./ExperimentDiagram2D";
import { createTrajectory } from "../experiments/workbench";

const defaultParameters = defaultHighSchoolParameters("double-slit") as unknown as DoubleSlitParameters;
const cases: Array<{ name: string; parameters: DoubleSlitParameters }> = [
  { name: "default", parameters: defaultParameters },
  { name: "minimum fringe spacing", parameters: { wavelengthNm: 400, slitSeparationMm: .5, screenDistance: .5, screenPositionMm: 0 } },
  { name: "previous decimation regression", parameters: { wavelengthNm: 500, slitSeparationMm: .5, screenDistance: .5, screenPositionMm: 0 } },
  { name: "maximum fringe spacing", parameters: { wavelengthNm: 700, slitSeparationMm: .1, screenDistance: 3, screenPositionMm: 0 } },
];

function diagram(parameters: DoubleSlitParameters) {
  const simulation = simulateHighSchoolExperiment("double-slit", { ...parameters });
  return { element: <ExperimentDiagram2D experimentId="double-slit" parameters={{ ...parameters }} simulation={simulation} trajectory={[]} />,
    points: simulation.series.find((series) => series.key === "intensity")!.points };
}

function gradientStops(html: string) {
  return [...html.matchAll(/<stop\s([^>]+)>/g)].map((match) => {
    const attributes = Object.fromEntries([...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
    return { offset: Number(attributes.offset), opacity: Number(attributes["stop-opacity"]) };
  });
}

describe("double-slit diagram full-resolution intensity screen", () => {
  it.each(cases)("preserves all model samples for $name", ({ parameters }) => {
    const { element, points } = diagram(parameters);
    const html = renderToStaticMarkup(element);
    const stops = gradientStops(html);
    expect(stops).toHaveLength(1601);
    expect(stops).toHaveLength(points.length);
    expect(html).toContain('gradientUnits="userSpaceOnUse" x1="0" y1="65" x2="0" y2="315"');
    expect(stops[0]!.offset).toBe(0);
    expect(stops.at(-1)!.offset).toBe(1);
    for (const [index, point] of points.entries()) {
      expect(stops[index]!.offset * 40 - 20).toBeCloseTo(point.x, 12);
      expect((stops[index]!.opacity - .06) / .94).toBeCloseTo(point.y, 12);
    }
    expect(html).not.toContain('height="1.8"');
  });

  it.each(cases.slice(0, 3))("retains the bright peak and intervening dark minimum for $name", ({ parameters }) => {
    const { element, points } = diagram(parameters);
    const stops = gradientStops(renderToStaticMarkup(element));
    const firstBrightMm = calculateDoubleSlitBrightPosition(parameters, 1)! * 1000;
    const closestIndex = (x: number) => points.reduce((best, point, index) => Math.abs(point.x - x) < Math.abs(points[best]!.x - x) ? index : best, 0);
    const brightIndex = closestIndex(firstBrightMm);
    const darkIndex = closestIndex(firstBrightMm / 2);
    expect(stops[closestIndex(0)]!.opacity).toBe(1);
    expect(stops[brightIndex]!.opacity).toBeGreaterThan(.99);
    expect(stops[darkIndex]!.opacity).toBeLessThan(.07);
    // 0.5 mm is a model maximum that was lost by selecting every eighth sample.
    if (parameters.wavelengthNm === 500) {
      expect(points[brightIndex]!.x).toBe(.5);
      expect(brightIndex % 8).not.toBe(0);
    }
  });

  it.each([[-20, 65], [0, 190], [20, 315]])("aligns the %s mm reading marker at SVG y=%s", (screenPositionMm, y) => {
    const html = renderToStaticMarkup(diagram({ ...defaultParameters, screenPositionMm }).element);
    expect(html).toContain(`d="M480 ${y}H630"`);
    expect(html).toContain(`x="640" y="${y + 5}"`);
  });

  it("keeps two diagrams' gradients independent within the same rendered document", () => {
    const first = diagram(cases[0]!.parameters).element;
    const second = diagram(cases[1]!.parameters).element;
    const html = renderToStaticMarkup(<>{first}{second}</>);
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((match) => match[1]!);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`height="250" fill="url(#${id})"`);
  });
});

describe("projectile observed path", () => {
  it("draws only elapsed positions over the model's full dashed trajectory", () => {
    const parameters = defaultHighSchoolParameters("projectile-motion");
    const first = simulateHighSchoolExperiment("projectile-motion", parameters, 0);
    const trajectory = createTrajectory("projectile-motion", parameters, first.durationSeconds);
    const renderAt = (time: number) => renderToStaticMarkup(<ExperimentDiagram2D experimentId="projectile-motion" parameters={parameters} simulation={simulateHighSchoolExperiment("projectile-motion", parameters, time)} trajectory={trajectory} />);
    const start = renderAt(0), halfway = renderAt(first.durationSeconds / 2), landing = renderAt(first.durationSeconds);
    expect(start).toContain('data-predicted-trajectory="true"');
    expect(start).not.toContain('data-observed-trajectory="true"');
    expect((start.match(/data-equal-time-marker=/g) ?? [])).toHaveLength(1);
    expect(halfway).toContain('data-observed-trajectory="true"');
    expect((halfway.match(/data-equal-time-marker=/g) ?? [])).toHaveLength(9);
    expect((landing.match(/data-equal-time-marker=/g) ?? [])).toHaveLength(17);
  });
});
