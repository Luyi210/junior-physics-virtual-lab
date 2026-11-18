import { PassThrough } from "node:stream";
import type { ComponentType, ReactNode } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fieldMeta, scienceModules } from "../features/experiments/catalog/scienceCatalog";
import { modules as opticsModules } from "../features/experiments/optics/catalog";

// Node can verify route composition and lazy imports; GPU drawing requires a browser.
vi.mock("../features/experiments/optics/workbench/LensCanvas", () => ({
  LensCanvas: () => <div data-renderer="lens-canvas" />
}));
vi.mock("../features/experiments/optics/components/OpticsLawScene3D", () => {
  const Scene = () => <div data-renderer="optics-3d" />;
  return { ReflectionScene3D: Scene, RefractionScene3D: Scene, PlaneMirrorScene3D: Scene, CurvedMirrorScene3D: Scene, LensSystemScene3D: Scene };
});

let Home: ComponentType, Student: ComponentType, Notebook: ComponentType, Textbook: ComponentType;
let Science: ComponentType, Optics: ComponentType, Teacher: ComponentType;

beforeAll(async () => {
  vi.stubEnv("VITE_DEMO_ONLY", "true");
  Home = (await import("../features/home/HomePage")).HomePage;
  Student = (await import("../features/student/pages/StudentDashboard")).StudentDashboard;
  Notebook = (await import("../features/student/pages/StudentExperimentNotebook")).StudentExperimentNotebook;
  Textbook = (await import("../features/student/pages/StudentTextbookLibrary")).StudentTextbookLibrary;
  Science = (await import("../features/experiments/ScienceExplorePage")).StudentScienceExplore;
  Optics = (await import("../features/experiments/optics/OpticsExplorePage")).StudentLensExplore;
  Teacher = (await import("../features/teacher/TeacherDashboard")).TeacherDashboard;
});
afterAll(() => vi.unstubAllEnvs());

function renderRoute(url: string, path: string, element: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    output.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    output.on("error", reject);
    const stream = renderToPipeableStream(
      <MemoryRouter initialEntries={[url]}><Routes><Route path={path} element={element} /></Routes></MemoryRouter>,
      { onAllReady() { stream.pipe(output); }, onError: reject }
    );
  });
}

describe("page composition after module extraction", () => {
  it("renders the homepage and student resources", async () => {
    for (const [url, Component] of [["/", Home], ["/student", Student], ["/student/notebook", Notebook], ["/student/textbook", Textbook]] as const) {
      const html = await renderRoute(url, url, <Component />);
      expect(html.length).toBeGreaterThan(1000);
      expect(html).not.toContain("data-msg=");
    }
  });

  for (const [field, modules] of Object.entries(scienceModules)) {
    it(`renders the ${field} catalog`, async () => {
      const html = await renderRoute(`/student/explore/${field}`, "/student/explore/:field", <Science />);
      expect(html).toContain(fieldMeta[field as keyof typeof fieldMeta].title);
    });
    for (const module of modules) {
      it(`renders the ${module.key} apparatus`, async () => {
        const html = await renderRoute(`/student/explore/${field}?module=${module.key}`, "/student/explore/:field", <Science />);
        expect(html).toContain(module.title);
        expect(html).toContain("science-lab");
        expect(html).not.toContain("data-msg=");
      });
    }
  }

  for (const module of opticsModules) {
    it(`renders the optics ${module.key} module`, async () => {
      const html = await renderRoute(`/student/explore/light?mode=${module.key}`, "/student/explore/light", <Optics />);
      expect(html).toContain(module.title);
      expect(html).not.toContain("data-msg=");
    });
  }

  for (const section of ["", "accounts", "classes", "lessons", "live", "reports"]) {
    it(`renders the teacher ${section || "overview"} page`, async () => {
      const html = await renderRoute(`/teacher/${section}`, "/teacher/*", <Teacher />);
      expect(html).toContain("teacher-console");
      expect(html).not.toContain("data-msg=");
    });
  }
});
