import { FormEvent, useState } from "react";
import { Atom, Compass, GraduationCap, KeyRound, LoaderCircle, LogIn, Sparkles, UserRound, WifiOff } from "lucide-react";

export function StudentIdentityPortal({ connection, onLogin, onGuest, onRetry }: {
  connection: "checking" | "online" | "offline";
  onLogin: (email: string, password: string) => Promise<void>;
  onGuest: () => void;
  onRetry: () => Promise<void>;
}) {
  const [email, setEmail] = useState("student01@physics.local");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await onLogin(email, password); }
    catch (error) { setMessage(error instanceof Error ? error.message : "登录失败"); }
    finally { setBusy(false); }
  }

  return <main className="student-login-portal">
    <div className="student-login-field" aria-hidden="true"><i /><i /><i /><span><Atom size={58} /></span><b>观察</b><b>改变</b><b>记录</b><b>解释</b></div>
    <section className="student-login-copy"><span><Sparkles size={15} />PHYSICS DISCOVERY ID</span><h1>带着自己的实验身份，<br />进入物理世界。</h1><p>登录后可以接收班级实验任务，并把操作、观察与新问题保存到自己的学习轨迹中。你也可以继续选择游客自由探索。</p><div><article><Compass size={18} /><span><b>自由探索仍然开放</b><small>登录不会把平台变成固定闯关</small></span></article><article><GraduationCap size={18} /><span><b>课堂任务自动连接</b><small>只显示属于你所在班级的任务</small></span></article></div></section>
    <section className="student-login-card"><header><i><UserRound size={23} /></i><div><span>STUDENT ACCESS</span><h2>学生实验身份登录</h2></div></header><div className={`student-login-signal is-${connection}`}>{connection === "offline" ? <WifiOff size={14} /> : connection === "checking" ? <LoaderCircle size={14} className="is-spinning" /> : <i />}<span>{connection === "checking" ? "正在连接学校数据" : connection === "online" ? "学校数据通道已连接" : "后台暂时离线"}</span></div>{connection !== "offline" ? <form onSubmit={submit}><label><span><UserRound size={13} />学生账号</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={connection === "checking"} /></label><label><span><KeyRound size={13} />登录密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" required disabled={connection === "checking"} /></label>{message && <p>{message}</p>}<button type="submit" disabled={busy || connection === "checking"}>{busy ? <LoaderCircle size={16} className="is-spinning" /> : <LogIn size={16} />}{busy ? "正在进入" : "登录并进入探索空间"}</button></form> : <div className="student-login-offline"><p>后台未连接，暂时不能读取班级任务。</p><button type="button" onClick={() => void onRetry()}>重新连接</button></div>}<footer><button type="button" onClick={() => { setEmail("student01@physics.local"); setPassword("Student123!"); }} disabled={connection !== "online"}>填入演示学生账号</button><button type="button" onClick={onGuest}>游客自由探索 →</button></footer></section>
  </main>;
}
