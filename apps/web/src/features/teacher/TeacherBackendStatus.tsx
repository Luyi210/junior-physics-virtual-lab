import { CloudOff, Server, X } from "lucide-react";
import type { PlatformUser } from "@physics-lab/contracts";

export function TeacherBackendStatus({ mode, user, summary, onLogout }: {
  mode: "api" | "local";
  user: PlatformUser | null;
  summary: { classes: number; tasks: number; students: number; teachers?: number };
  onLogout: () => void;
}) {
  const connected = mode === "api" && Boolean(user);
  return (
    <div className={`teacher-side-signal teacher-backend-status ${connected ? "state-authenticated" : "state-offline"}`}>
      <div>{connected ? <Server size={15} /> : <CloudOff size={15} />}<span>{connected ? "API AUTHENTICATED" : "LOCAL FALLBACK"}</span><i /></div>
      <strong>{connected ? `${user?.name} · 后台已登录` : "本地演示工作区"}</strong>
      <p>{connected ? user?.role === "admin" ? `真实后台：${summary.teachers ?? 0} 个教师、${summary.students} 个学生、${summary.classes} 个班级。` : `真实后台：${summary.students} 个学生、${summary.classes} 个班级、${summary.tasks} 个任务。` : "当前操作仅保存在此浏览器，不会写入学校账号数据。"}</p>
      <button type="button" onClick={onLogout}><X size={13} />{connected ? "退出后台" : "退出演示"}</button>
    </div>
  );
}
