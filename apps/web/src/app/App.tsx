import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PhysicsContextLayer } from "../shared/components/PhysicsContextLayer";
import { HomePage } from "../features/home/HomePage";

const HighSchoolHomePage = lazy(() => import("../features/high-school/pages/HighSchoolHomePage").then((module) => ({ default: module.HighSchoolHomePage })));
const HighSchoolExperimentPage = lazy(() => import("../features/high-school/pages/HighSchoolExperimentPage").then((module) => ({ default: module.HighSchoolExperimentPage })));
const HighSchoolProblemPage = lazy(() => import("../features/high-school/problems/HighSchoolProblemPage").then((module) => ({ default: module.HighSchoolProblemPage })));
const LiliAssistant = lazy(() => import("../features/high-school/assistant/LiliAssistant").then((module) => ({ default: module.LiliAssistant })));
const UserGuidePage = lazy(() => import("../features/guide/UserGuidePage").then((module) => ({ default: module.UserGuidePage })));

const ExperimentTaskContextBar = lazy(async () => {
  const module = await import("../features/experiments/shared/ExperimentTaskContextBar");
  return { default: module.ExperimentTaskContextBar };
});

const HarnessRuntime = lazy(async () => {
  const module = await import("../features/assistant/HarnessRuntime");
  return { default: module.HarnessRuntime };
});

const StudentDashboard = lazy(async () => {
  const module = await import("../features/student/pages/StudentDashboard");
  return { default: module.StudentDashboard };
});

const StudentExperimentNotebook = lazy(async () => {
  const module = await import("../features/student/pages/StudentExperimentNotebook");
  return { default: module.StudentExperimentNotebook };
});

const StudentLearningRecordPage = lazy(async () => {
  const module = await import("../features/student/pages/StudentLearningRecordPage");
  return { default: module.StudentLearningRecordPage };
});

const StudentTextbookLibrary = lazy(async () => {
  const module = await import("../features/student/pages/StudentTextbookLibrary");
  return { default: module.StudentTextbookLibrary };
});

const TeacherDashboard = lazy(async () => {
  const module = await import("../features/teacher/TeacherDashboard");
  return { default: module.TeacherDashboard };
});

const LensWorkbench = lazy(async () => {
  const module = await import("../features/experiments/optics/workbench/LensWorkbench");
  return { default: module.LensWorkbench };
});

const StudentLensExplore = lazy(async () => {
  const module = await import("../features/experiments/optics/OpticsExplorePage");
  return { default: module.StudentLensExplore };
});

const StudentScienceExplore = lazy(async () => {
  const module = await import("../features/experiments/ScienceExplorePage");
  return { default: module.StudentScienceExplore };
});

function LegacyLensRedirect() {
  const location = useLocation();
  return <Navigate to={`/student/explore/light${location.search}`} replace />;
}

export default function App() {
  const location = useLocation();
  const harnessEnabled = location.pathname === "/lab/lens" || location.pathname.startsWith("/student/explore/");
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/guide" element={<Suspense fallback={<PageRouteLoading title="正在打开使用指南" />}><UserGuidePage /></Suspense>} />
        <Route path="/high-school" element={<Suspense fallback={<PageRouteLoading title="正在打开高中实验室" />}><HighSchoolHomePage /></Suspense>} />
        <Route path="/high-school/problems" element={<Suspense fallback={<PageRouteLoading title="正在绘制物理题目" />}><HighSchoolProblemPage /></Suspense>} />
        <Route path="/high-school/experiments/:experimentId" element={<Suspense fallback={<PageRouteLoading title="正在装配高中实验仪器" />}><HighSchoolExperimentPage /></Suspense>} />
        <Route path="/student" element={<Suspense fallback={<PageRouteLoading title="正在进入学生探索空间" />}><StudentDashboard /></Suspense>} />
        <Route path="/student/notebook" element={<Suspense fallback={<PageRouteLoading title="正在打开实验记录本" />}><StudentExperimentNotebook /></Suspense>} />
        <Route path="/student/records/:sessionId" element={<Suspense fallback={<PageRouteLoading title="正在读取实验档案" />}><StudentLearningRecordPage /></Suspense>} />
        <Route path="/student/textbook" element={<Suspense fallback={<PageRouteLoading title="正在编排课本知识图鉴" />}><StudentTextbookLibrary /></Suspense>} />
        <Route path="/teacher/*" element={<Suspense fallback={<PageRouteLoading title="正在进入教师端" />}><TeacherDashboard /></Suspense>} />
        <Route
          path="/student/explore/light"
          element={
            <Suspense fallback={<div className="route-loading student-loading"><span /><strong>正在进入光现象探索岛</strong><small>PREPARING DISCOVERY SPACE</small></div>}>
              <StudentLensExplore />
            </Suspense>
          }
        />
        <Route path="/student/explore/lens" element={<LegacyLensRedirect />} />
        <Route
          path="/student/explore/:field"
          element={
            <Suspense fallback={<div className="route-loading student-loading"><span /><strong>正在启动动态实验</strong><small>INITIALIZING SIMULATION</small></div>}>
              <StudentScienceExplore />
            </Suspense>
          }
        />
        <Route
          path="/lab/lens"
          element={
            <Suspense fallback={<div className="route-loading"><span /><strong>正在装配实验仪器</strong><small>LOADING SIMULATION CORE</small></div>}>
              <LensWorkbench />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PhysicsContextLayer />
      {harnessEnabled && <Suspense fallback={null}><ExperimentTaskContextBar /><HarnessRuntime /></Suspense>}
      {location.pathname.startsWith("/high-school") && <Suspense fallback={null}><LiliAssistant key={location.pathname} /></Suspense>}
    </>
  );
}

function PageRouteLoading({ title }: { title: string }) {
  return <div className="route-loading student-loading"><span /><strong>{title}</strong><small>LOADING PHYSICS SPACE</small></div>;
}
