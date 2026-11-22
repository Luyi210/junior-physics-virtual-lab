import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { highSchoolExperiments } from "@physics-lab/knowledge/high-school";
import { createCapacitorHistory, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, simulateHighSchoolExperiment } from "@physics-lab/physics";
import { HighSchoolHomePage } from "../pages/HighSchoolHomePage";
import { HighSchoolExperimentPage } from "../pages/HighSchoolExperimentPage";
import { ExperimentPlot } from "../components/ExperimentPlot";
import { advanceExperimentClock, FIXED_TIME_STEP } from "./workbench";

function renderExperiment(id: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[`/high-school/experiments/${id}`]}><Routes><Route path="/high-school/experiments/:experimentId" element={<HighSchoolExperimentPage />} /></Routes></MemoryRouter>);
}

describe("high-school experiment route composition", () => {
  it("links only to implemented experiments and labels the planned curriculum honestly", () => {
    const html = renderToStaticMarkup(<MemoryRouter><HighSchoolHomePage /></MemoryRouter>);
    const linkedIds = [...html.matchAll(/href="\/high-school\/experiments\/([^\"]+)"/g)].map((match) => match[1]);
    expect(new Set(linkedIds)).toEqual(new Set(HIGH_SCHOOL_EXPERIMENTS.map((item) => item.id)));
    expect(highSchoolExperiments.filter((item) => item.status === "ready")).toHaveLength(24);
    expect(html).toContain("教材与课程依据");
    expect(html).toContain("2025");
  });

  for (const definition of HIGH_SCHOOL_EXPERIMENTS) {
    it(`renders the ${definition.id} controls, diagram, model, chart and records without WebGL`, () => {
      const html = renderExperiment(definition.id);
      expect(html).toContain(definition.title);
      for (const parameter of definition.parameters) expect(html).toContain(`id="hs-range-${parameter.key}"`);
      expect(html).toContain('class="hs-diagram"');
      expect(html).toContain('class="hs-plot"');
      if (simulateHighSchoolExperiment(definition.id, defaultHighSchoolParameters(definition.id), 0, definition.id === "capacitor-charge" ? createCapacitorHistory("render-check") : undefined).state.readingValid !== 0) expect(html).toContain('data-current-point="');
      expect(html).toContain("记录这组读数");
      expect(html).toContain("导出 CSV");
      expect(html).toContain("模型与边界");
      expect(html).toContain("仿真记录分析");
      expect(html).toContain('class="hs-parameter-number"');
      const duration = simulateHighSchoolExperiment(definition.id, defaultHighSchoolParameters(definition.id), 0, definition.id === "capacitor-charge" ? createCapacitorHistory("duration-check") : undefined).durationSeconds;
      if (duration > 0) expect(html).toContain('aria-label="观察速度"');
      else expect(html).not.toContain('aria-label="观察速度"');
      if (definition.id === "pendulum" || definition.id === "double-slit") expect(html).toContain("手动读数档案");
      else if (definition.id === "mechanical-energy") { expect(html).toContain("请确认当前档案归属后使用纸带读数工具"); expect(html).not.toContain("纸带手动读数档案"); }
      else expect(html).not.toContain("手动读数档案");
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("Infinity");
    });
  }

  it("does not substitute another apparatus for planned or unknown routes", () => {
    for (const planned of highSchoolExperiments.filter((item) => item.status === "planned")) {
      expect(renderExperiment(planned.id)).toContain("正在筹备");
      expect(renderExperiment(planned.id)).not.toContain('class="hs-diagram"');
    }
    expect(renderExperiment("nonexistent-experiment")).toContain("还没有找到这个实验");
  });

  it("opens spring loading as a static model with original-length evidence and no pretend manual instrument", () => {
    const html = renderExperiment("spring-force");
    expect(html).toContain('aria-label="弹簧加载台"');
    expect(html).toContain("先卸载，再逐级加码");
    expect(html).toContain("全部卸载");
    expect(html).toContain("质量包含托盘");
    expect(html).toContain("x = L − L₀");
    expect(html).toContain('data-spring-natural-marker="true"');
    expect(html).toContain('data-spring-length-marker="true"');
    expect(html).toContain('value="force-extension"');
    expect(html).toContain("不自动记录");
    expect(html).not.toContain("手动读数档案");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="播放实验"/);
  });

  it("opens force composition with independent trial controls and an explicitly geometric comparison", () => {
    const html = renderExperiment("force-composition");
    expect(html).toContain('aria-label="共点力等效对照台"');
    expect(html).toContain('data-force-handle="trial"');
    expect(html).toContain("二维拖动");
    expect(html).toContain("三维矢量板");
    expect(html).toContain("不替你填写单力");
    expect(html).toContain("0.05 N 是教学对照阈值");
    expect(html).toContain('value="resultant-squared-cosine"');
    expect(html).not.toContain("手动读数档案");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="播放实验"/);
  });
});

describe("fixed experiment clock", () => {
  function advanceFrames(elapsed: number[]) {
    let clock = { tick: 0, remainder: 0, finished: false };
    for (const frame of elapsed) clock = advanceExperimentClock(clock.tick, clock.remainder, frame, 10);
    return clock;
  }

  it("reaches the same simulated time with different display frame rates", () => {
    const sixty = advanceFrames(Array.from({ length: 60 }, () => 1 / 60));
    const thirty = advanceFrames(Array.from({ length: 30 }, () => 1 / 30));
    expect(sixty.tick).toBe(60);
    expect(thirty.tick).toBe(sixty.tick);
  });

  it("accumulates sub-step elapsed time instead of advancing by one tick per render", () => {
    const first = advanceExperimentClock(0, 0, FIXED_TIME_STEP / 3, 10);
    expect(first.tick).toBe(0);
    const second = advanceExperimentClock(first.tick, first.remainder, FIXED_TIME_STEP * 2 / 3, 10);
    expect(second.tick).toBe(1);
  });

  it("stops at the duration boundary without creating additional motion", () => {
    const result = advanceExperimentClock(299, 0, .5, 5);
    expect(result).toMatchObject({ tick: 300, finished: true });
    expect(advanceExperimentClock(result.tick, 0, 1, 5).tick).toBe(300);
    expect(advanceExperimentClock(0, 0, 1, 0)).toMatchObject({ tick: 0, finished: true });
  });
});

describe("plot cursor uses the live model state", () => {
  it("moves on the first fixed step even between sampled curve points", () => {
    const parameters = { ...defaultHighSchoolParameters("uniform-acceleration"), duration: 10 };
    const simulation = simulateHighSchoolExperiment("uniform-acceleration", parameters, FIXED_TIME_STEP);
    const graph = simulation.series[0];
    const point = { x: simulation.state[graph.xKey], y: simulation.state[graph.key] };
    const html = renderToStaticMarkup(<ExperimentPlot series={graph} currentPoint={point} />);
    expect(point.x).toBe(FIXED_TIME_STEP);
    expect(point.y).not.toBe(0);
    expect(html).toContain(`data-current-point="${point.x},${point.y}"`);
    expect(html).not.toContain('data-current-point="0,0"');
  });

  it("can plot the precise working point for every available graph, including steady experiments", () => {
    for (const definition of HIGH_SCHOOL_EXPERIMENTS) {
      const simulation = simulateHighSchoolExperiment(definition.id, defaultHighSchoolParameters(definition.id), .1, definition.id === "capacitor-charge" ? createCapacitorHistory("render") : undefined);
      for (const graph of simulation.series) {
        const point = { x: simulation.state[graph.xKey], y: simulation.state[graph.key] };
        expect(Number.isFinite(point.x), `${definition.id}/${graph.key} x`).toBe(true);
        expect(Number.isFinite(point.y), `${definition.id}/${graph.key} y`).toBe(true);
        expect(renderToStaticMarkup(<ExperimentPlot series={graph} currentPoint={point} />)).toContain('data-current-point="');
      }
    }
  });
});
