export interface LabParameterApplyResult {
  applied: boolean;
  message: string;
}

export type LabParameterController = (patch: Record<string, number>) => LabParameterApplyResult;

const controllers = new Map<string, LabParameterController>();

export function registerLabParameterController(
  experimentId: string,
  controller: LabParameterController
): () => void {
  controllers.set(experimentId, controller);
  return () => {
    if (controllers.get(experimentId) === controller) {
      controllers.delete(experimentId);
    }
  };
}

export function hasActiveLabController(experimentId: string): boolean {
  return controllers.has(experimentId);
}

export function applyAgentLabParameters(
  experimentId: string,
  patch: Record<string, number>
): LabParameterApplyResult {
  const controller = controllers.get(experimentId);
  if (!controller) {
    return {
      applied: false,
      message: "请先进入对应实验台页面，再点击一键写入参数。"
    };
  }
  return controller(patch);
}
