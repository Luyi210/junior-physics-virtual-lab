import { FormEvent, useState } from "react";
import { Atom, Database, Fingerprint, KeyRound, LoaderCircle, LogIn, Orbit, ShieldCheck, WifiOff } from "lucide-react";

type ConnectionState = "checking" | "online" | "offline";

export function TeacherLoginPortal({ connection, onLogin, onRetry, onOffline }: {
  connection: ConnectionState;
  onLogin: (email: string, password: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onOffline: () => void;
}) {
  const [email, setEmail] = useState("teacher@physics.local");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      await onLogin(email, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败，请检查账号信息");
    } finally {
      setSubmitting(false);
    }
  }

  function fillTeacherAccount() {
    setEmail("teacher@physics.local");
    setPassword("Teacher123!");
    setMessage("");
  }

  function fillAdminAccount() {
    setEmail("admin@physics.local");
    setPassword("Admin123!");
    setMessage("");
  }

  return (
    <main className="teacher-login-portal">
      <div className="teacher-login-grid" aria-hidden="true" />
      <section className="teacher-login-observatory" aria-hidden="true">
        <div className="teacher-login-orbit"><i /><i /><i /><span><Atom size={46} /></span><b>F = ma</b><em>λ = v / f</em></div>
        <div className="teacher-login-coordinate"><span>LAB COORDINATE</span><strong>31.2304° N<br />121.4737° E</strong></div>
        <div className="teacher-login-signal"><i /><i /><i /><i /><i /></div>
      </section>

      <section className="teacher-login-panel">
        <header>
          <div className="teacher-login-mark"><Orbit size={25} /></div>
          <div><span>PHYSICS EDUCATION OPERATING SYSTEM</span><h1>实验教学管理中枢</h1><p>教师教学与平台账号统一入口</p></div>
        </header>

        <div className={`teacher-login-connection is-${connection}`}>
          {connection === "checking" ? <LoaderCircle size={16} className="is-spinning" /> : connection === "online" ? <Database size={16} /> : <WifiOff size={16} />}
          <span>{connection === "checking" ? "正在校验后台数据通道" : connection === "online" ? "数据服务已连接 · 身份认证可用" : "后台暂时离线 · 可进入本地演示模式"}</span><i />
        </div>

        {connection !== "offline" ? <form onSubmit={submit}>
          <label><span><Fingerprint size={14} />教师 / 管理员账号</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required disabled={connection === "checking"} /></label>
          <label><span><KeyRound size={14} />登录密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入登录密码" required disabled={connection === "checking"} /></label>
          {message && <p className="teacher-login-message">{message}</p>}
          <button className="teacher-login-submit" type="submit" disabled={submitting || connection === "checking"}>{submitting ? <LoaderCircle size={17} className="is-spinning" /> : <LogIn size={17} />}<span>{submitting ? "正在建立安全会话" : "进入教学管理平台"}</span><em>→</em></button>
        </form> : <div className="teacher-login-offline">
          <WifiOff size={25} /><b>暂时无法连接后台</b><p>你仍可查看原有本地演示工作区，期间不会写入学校账号与班级数据。</p>
          <div><button type="button" onClick={() => void onRetry()}>重新连接</button><button type="button" onClick={onOffline}>进入离线演示</button></div>
        </div>}

        <footer>
          <div className="teacher-login-demo-accounts">
            <button type="button" onClick={fillAdminAccount} disabled={connection !== "online"}><ShieldCheck size={13} />管理员演示账号</button>
            <button type="button" onClick={fillTeacherAccount} disabled={connection !== "online"}><Fingerprint size={13} />教师演示账号</button>
          </div>
          <p><span>认证方式</span><b>SCRYPT + SIGNED TOKEN</b></p>
        </footer>
      </section>
    </main>
  );
}
