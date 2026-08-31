import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlatformUser, TeachingClass, TeachingLesson, TeachingTask } from "@physics-lab/contracts";
import { ArrowLeft, BarChart3, BookOpenCheck, Boxes, FlaskConical, Home, Menu, Radio, UserCog, Users, X } from "lucide-react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { PageIntroduction } from "../../components/PageIntroduction";
import {
  createClassReport,
  createLiveSession,
  loadTeacherWorkspace,
  saveTeacherWorkspace,
  TeacherClass,
  TeacherLesson,
  TeacherWorkspace
} from "./teacherWorkspace";
import { TeacherGuangguang } from "./TeacherGuangguang";
import { TeacherCommandCenter } from "./TeacherCommandCenter";
import { TeacherBackendStatus } from "./TeacherBackendStatus";
import { TeacherAccountCenter } from "./TeacherAccountCenter";
import { TeacherLoginPortal } from "./TeacherLoginPortal";
import { TeacherRealClasses } from "./TeacherRealClasses";
import { TeacherTeachingFlow } from "./TeacherTeachingFlow";
import { TeacherClasses, TeacherLessons, TeacherLiveClassroom, TeacherOverview, TeacherReports } from "./TeacherSections";
import { teacherApi } from "../../services/teacherApi";

const navigation = [
  { to: "/teacher", label: "教学总览", eyebrow: "OVERVIEW", icon: Home, end: true },
  { to: "/teacher/accounts", label: "账号与成员", eyebrow: "IDENTITIES", icon: UserCog },
  { to: "/teacher/classes", label: "班级管理", eyebrow: "CLASSES", icon: Users },
  { to: "/teacher/lessons", label: "实验备课", eyebrow: "LESSON LAB", icon: BookOpenCheck },
  { to: "/teacher/live", label: "课堂控制台", eyebrow: "LIVE CONSOLE", icon: Radio },
  { to: "/teacher/reports", label: "学情报告", eyebrow: "EVIDENCE", icon: BarChart3 }
];

const routeTitles: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/teacher": { eyebrow: "TEACHING OBSERVATORY", title: "教学总览", description: "从备课到课堂证据，一屏掌握今天的实验教学。" },
  "/teacher/accounts": { eyebrow: "IDENTITY NETWORK", title: "账号与成员", description: "管理真实学生账号、登录权限与班级归属。" },
  "/teacher/classes": { eyebrow: "CLASS COORDINATES", title: "班级管理", description: "组织班级与入口码，为实验课建立清晰边界。" },
  "/teacher/lessons": { eyebrow: "LESSON ENGINEERING", title: "实验备课", description: "从物理现象出发，设计问题、变量与课堂节奏。" },
  "/teacher/live": { eyebrow: "LIVE SIGNAL", title: "课堂控制台", description: "观察学习进程，在关键时刻向全班发布追问。" },
  "/teacher/reports": { eyebrow: "LEARNING EVIDENCE", title: "学情报告", description: "用操作和观察证据复盘课堂，不做简单排名。" }
};

export function TeacherDashboard() {
  const [workspace, setWorkspace] = useState<TeacherWorkspace>(() => loadTeacherWorkspace());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [connection, setConnection] = useState<"checking" | "online" | "offline">("checking");
  const [apiUser, setApiUser] = useState<PlatformUser | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [remoteData, setRemoteData] = useState<{ students: PlatformUser[]; teachers: PlatformUser[]; classes: TeachingClass[]; lessons: TeachingLesson[]; tasks: TeachingTask[] }>({ students: [], teachers: [], classes: [], lessons: [], tasks: [] });
  const location = useLocation();
  const page = routeTitles[location.pathname] ?? routeTitles["/teacher"];

  const refreshRemoteData = useCallback(async (role: PlatformUser["role"] = "teacher") => {
    const [students, teachers, classes, lessons, tasks] = await Promise.all([
      teacherApi.users("student"),
      role === "admin" ? teacherApi.users("teacher") : Promise.resolve([]),
      teacherApi.classes(), teacherApi.lessons(), teacherApi.tasks()
    ]);
    setRemoteData({ students, teachers, classes, lessons, tasks });
  }, []);
  const refreshCurrentRemoteData = useCallback(() => refreshRemoteData(apiUser?.role ?? "teacher"), [apiUser?.role, refreshRemoteData]);

  const checkBackend = useCallback(async () => {
    setConnection("checking");
    try {
      await teacherApi.health();
      setConnection("online");
      if (!teacherApi.hasSession()) return;
      try {
        const current = await teacherApi.me();
        if (current.role !== "teacher" && current.role !== "admin") throw new Error("教师端仅允许教师或管理员登录");
        setApiUser(current);
        setLocalMode(false);
        await refreshRemoteData(current.role);
      } catch {
        teacherApi.logout();
        setApiUser(null);
      }
    } catch {
      setConnection("offline");
      setApiUser(null);
    }
  }, [refreshRemoteData]);

  useEffect(() => { void checkBackend(); }, [checkBackend]);

  useEffect(() => saveTeacherWorkspace(workspace), [workspace]);
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const activeLesson = useMemo(() => workspace.lessons.find((lesson) => lesson.id === workspace.liveSession?.lessonId), [workspace.lessons, workspace.liveSession]);

  async function login(email: string, password: string) {
    const session = await teacherApi.login(email, password);
    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      teacherApi.logout();
      throw new Error("该账号不是教师或管理员账号，请从学生端进入");
    }
    setApiUser(session.user);
    setLocalMode(false);
    setConnection("online");
    await refreshRemoteData(session.user.role);
  }

  function logout() {
    teacherApi.logout();
    setApiUser(null);
    setLocalMode(false);
    setRemoteData({ students: [], teachers: [], classes: [], lessons: [], tasks: [] });
    setConnection((current) => current === "offline" ? "offline" : "online");
  }

  function addClass(classItem: TeacherClass) {
    setWorkspace((current) => ({ ...current, classes: [classItem, ...current.classes] }));
  }

  function addLesson(lesson: TeacherLesson) {
    setWorkspace((current) => ({ ...current, lessons: [lesson, ...current.lessons] }));
  }

  function launchLesson(lessonId: string) {
    setWorkspace((current) => {
      const lesson = current.lessons.find((item) => item.id === lessonId);
      if (!lesson) return current;
      return { ...current, liveSession: createLiveSession(lesson), lessons: current.lessons.map((item) => item.id === lessonId ? { ...item, status: "ready" } : item) };
    });
  }

  function updateLiveSession(liveSession: TeacherWorkspace["liveSession"]) {
    setWorkspace((current) => ({ ...current, liveSession }));
  }

  function endLiveSession() {
    setWorkspace((current) => {
      if (!current.liveSession) return current;
      const report = createClassReport(current, current.liveSession);
      return {
        ...current,
        liveSession: null,
        reports: [report, ...current.reports],
        lessons: current.lessons.map((lesson) => lesson.id === current.liveSession?.lessonId ? { ...lesson, status: "completed" } : lesson)
      };
    });
  }

  function broadcastGuangguangPrompt(text: string) {
    if (!workspace.liveSession) return false;
    setWorkspace((current) => current.liveSession ? {
      ...current,
      liveSession: {
        ...current.liveSession,
        prompts: [{ id: `guangguang-prompt-${Date.now()}`, text, createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }, ...current.liveSession.prompts]
      }
    } : current);
    return true;
  }

  if (!apiUser && !localMode) return <TeacherLoginPortal connection={connection} onLogin={login} onRetry={checkBackend} onOffline={() => setLocalMode(true)} />;

  return (
    <div className="teacher-console">
      {apiUser && <PageIntroduction
        pageKey="teacher-authenticated-workflow"
        eyebrow="TEACHER WORKFLOW / 教师教学闭环"
        title={apiUser.role === "admin" ? "先建立可信账号体系，再组织学校实验教学。" : "从真实学生账号开始，组织一堂实验课。"}
        description={apiUser.role === "admin" ? "管理员可以创建教师与学生身份，并维护账号状态、密码和班级关系；教学工作仍由教师端课例与任务流程承接。" : "教师端已经连接学校后台。按照账号、班级、课例、任务和课堂证据的顺序工作，可以让学生的真实操作进入教学观察。"}
        points={apiUser.role === "admin" ? ["创建教师与学生账号", "管理登录权限与临时密码", "建立班级并确认学生归属", "监督课例、任务与教学数据"] : ["管理学生账号与登录权限", "建立班级并确认成员", "创建课例并向班级发布任务", "从课堂信号和报告中复盘证据"]}
        icon={BookOpenCheck}
        accent="#78ddff"
        variant="teacher"
        persistence="local"
        triggerLabel="教师向导"
        enterLabel="进入教学总览"
        steps={[
          apiUser.role === "admin"
            ? { eyebrow: "01 / IDENTITY NETWORK", title: "先建立学校师生身份网络。", description: "在“账号与成员”中分别创建教师和学生，维护登录状态与临时密码，再为学生确认班级归属。", points: ["管理员可新增并管理教师与学生", "教师只能管理学生，不能操作其他教师", "账号密码只以散列写入数据库"], icon: UserCog }
            : { eyebrow: "01 / IDENTITY NETWORK", title: "先建立真实学生身份。", description: "在“账号与成员”中创建学生、重置临时密码、停用异常账号，并确认每名学生的班级归属。", points: ["学生和教师使用独立登录会话", "停用后已有访问令牌立即失效", "账号密码只以散列写入数据库"], icon: UserCog },
          { eyebrow: "02 / CLASS COORDINATES", title: "用真实班级建立教学边界。", description: "班级页显示数据库中的入口码、学生人数和真实成员。创建新班级后，可回到账号中心为学生分班。", points: ["入口码由后台自动生成", "成员状态与账号中心保持一致"], icon: Users },
          { eyebrow: "03 / LESSON DELIVERY", title: "把实验模板变成可发布的探究课例。", description: "在实验备课中设置核心问题、预测、变量控制和证据要求，然后发布为课前、课堂或课后任务。", points: ["学生只看到本班已发布任务", "可设置开放时间和截止时间", "任务关闭后不能再创建新会话"], icon: BookOpenCheck },
          { eyebrow: "04 / LEARNING EVIDENCE", title: "依据实验过程追问，不做简单排名。", description: "学生从任务启动实验后，关键操作与观察会进入后台。实时课堂和报告将继续围绕证据密度、停滞信号和解释过程升级。", points: ["光光建议需教师确认后发布", "课堂证据不自动等同于能力评价"], icon: BarChart3 }
        ]}
      />}
      <div className="teacher-console-grid" aria-hidden="true" />
      <button className="teacher-mobile-menu" type="button" onClick={() => setMobileOpen((value) => !value)} aria-label="打开教师端导航">
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`teacher-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link className="teacher-brand" to="/"><BrandMark /></Link>
        <div className="teacher-system-id"><span>PHY EDU / {apiUser?.role === "admin" ? "A-01" : "T-01"}</span><b>{apiUser?.role === "admin" ? "平台综合管理站" : "教师教学观测站"}</b></div>
        <nav aria-label="教师工作台导航">
          {navigation.map(({ to, label, eyebrow, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <i><Icon size={18} /></i><span><small>{eyebrow}</small><b>{label}</b></span><em>→</em>
            </NavLink>
          ))}
        </nav>
        <TeacherBackendStatus mode={apiUser ? "api" : "local"} user={apiUser} summary={{ students: remoteData.students.length, teachers: remoteData.teachers.length, classes: remoteData.classes.length, tasks: remoteData.tasks.length }} onLogout={logout} />
        <Link className="teacher-back-home" to="/"><ArrowLeft size={15} />返回平台首页</Link>
      </aside>

      <main className="teacher-workspace">
        <header className="teacher-workspace-header">
          <div><span>{page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></div>
          <div className="teacher-header-actions">
            <TeacherCommandCenter workspace={workspace} />
            <div className="teacher-header-status">
              <span><i />教学空间已就绪</span>
              <b>{apiUser?.name ?? workspace.teacherName}</b>
              <small>{apiUser ? apiUser.role === "admin" ? "已认证管理员 · 真实后台" : "已认证教师 · 真实后台" : "演示身份 · 本地模式"}</small>
            </div>
          </div>
        </header>

        <section className="teacher-route-stage">
          <Routes>
            <Route index element={<TeacherOverview workspace={workspace} onLaunch={launchLesson} remote={apiUser ? remoteData : undefined} />} />
            <Route path="accounts" element={apiUser ? <TeacherAccountCenter currentUser={apiUser} students={remoteData.students} teachers={remoteData.teachers} classes={remoteData.classes} onRefresh={refreshCurrentRemoteData} /> : <TeacherAccountOffline />} />
            <Route path="classes" element={apiUser ? <TeacherRealClasses classes={remoteData.classes} students={remoteData.students} onRefresh={refreshCurrentRemoteData} /> : <TeacherClasses classes={workspace.classes} onAdd={addClass} />} />
            <Route path="lessons" element={apiUser ? <TeacherTeachingFlow classes={remoteData.classes} lessons={remoteData.lessons} tasks={remoteData.tasks} onRefresh={refreshCurrentRemoteData} /> : <TeacherLessons workspace={workspace} onAdd={addLesson} onLaunch={launchLesson} />} />
            <Route path="live" element={<TeacherLiveClassroom workspace={workspace} activeLesson={activeLesson} onLaunch={launchLesson} onUpdate={updateLiveSession} onEnd={endLiveSession} />} />
            <Route path="reports" element={<TeacherReports reports={workspace.reports} />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Routes>
        </section>

        <footer className="teacher-console-footer">
          <span><Boxes size={14} />教师实验教学工作台</span>
          <span><FlaskConical size={14} />依据实验过程生成学习证据</span>
          <Link to="/student">进入学生实验端 →</Link>
        </footer>
      </main>
      <TeacherGuangguang workspace={workspace} pathname={location.pathname} onBroadcast={broadcastGuangguangPrompt} />
    </div>
  );
}

function TeacherAccountOffline() {
  return <div className="teacher-account-offline"><UserCog size={34} /><span>IDENTITY NETWORK OFFLINE</span><h2>账号管理需要连接真实后台</h2><p>退出本地演示模式并登录教师账号后，可管理学生账号、密码和班级归属。</p></div>;
}
