import { type HarnessArea } from "@physics-lab/harness";

export function routeHarnessContext(pathname: string, search: string): { area: HarnessArea; module: string } | undefined {
  const params = new URLSearchParams(search);
  if (pathname === "/lab/lens") return { area: "lens", module: "bench" };
  if (pathname === "/student/explore/light") {
    return { area: "optics", module: params.get("mode") ?? "overview" };
  }
  const value = pathname.match(/^\/student\/explore\/(sound|mechanics|circuit|thermal|measurement)$/)?.[1];
  if (!value) return undefined;
  return { area: value as HarnessArea, module: params.get("module") ?? `${value}-overview` };
}
