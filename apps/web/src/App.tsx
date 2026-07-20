import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HarnessRuntime } from "./features/harness/HarnessRuntime";
import { HomePage } from "./features/home/HomePage";
import { StudentDashboard } from "./features/student/StudentDashboard";

const LensWorkbench = lazy(async () => {
  const module = await import("./features/lens/LensWorkbench");
  return { default: module.LensWorkbench };
});

const StudentLensExplore = lazy(async () => {
  const module = await import("./features/student/StudentLensExplore");
  return { default: module.StudentLensExplore };
});

const StudentScienceExplore = lazy(async () => {
  const module = await import("./features/student/StudentScienceExplore");
  return { default: module.StudentScienceExplore };
});

function LegacyLensRedirect() {
  const location = useLocation();
  return <Navigate to={`/student/explore/light${location.search}`} replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/student" element={<StudentDashboard />} />
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
      <HarnessRuntime />
    </>
  );
}
