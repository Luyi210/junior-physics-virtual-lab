import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Box, RotateCcw } from "lucide-react";

interface OpticsSceneErrorBoundaryProps {
  children: ReactNode;
  label: string;
}

interface OpticsSceneErrorBoundaryState {
  failed: boolean;
}

export class OpticsSceneErrorBoundary extends Component<OpticsSceneErrorBoundaryProps, OpticsSceneErrorBoundaryState> {
  state: OpticsSceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): OpticsSceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Optics 3D scene failed: ${this.props.label}`, error, info.componentStack);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="optics-3d-recovery" role="alert">
      <Box size={30} />
      <strong>{this.props.label}暂时无法载入</strong>
      <span>上方的二维视图仍可正常完成实验；也可以重试装配三维场景。</span>
      <button type="button" onClick={this.retry}><RotateCcw size={15} />重新装配三维场景</button>
    </div>;
  }
}
