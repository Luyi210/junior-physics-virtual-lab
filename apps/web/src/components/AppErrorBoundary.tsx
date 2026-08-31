import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";

interface AppErrorBoundaryProps { children: ReactNode; }
interface AppErrorBoundaryState { error?: Error; }

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Physics Lab page render failed", error, info.componentStack);
  }

  private reload = () => window.location.reload();

  private returnHome = () => {
    window.location.hash = "#/";
    this.setState({ error: undefined });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="app-recovery-screen">
      <section>
        <div className="app-recovery-mark"><TriangleAlert size={34} /><i /><i /></div>
        <span>PAGE RECOVERY / 页面恢复</span>
        <h1>这一页没有完整装配好。</h1>
        <p>可能是网页刚刚更新、旧资源仍留在浏览器中，或者三维模块加载中断。实验记录保存在本机，不会因为刷新消失。</p>
        <code>{this.state.error.message.slice(0, 160)}</code>
        <div><button type="button" onClick={this.reload}><RefreshCw size={17} />重新加载最新页面</button><button type="button" onClick={this.returnHome}><Home size={17} />返回平台首页</button></div>
      </section>
    </main>;
  }
}
