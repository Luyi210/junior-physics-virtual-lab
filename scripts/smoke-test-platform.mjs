import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = new URL(process.env.PHYSICS_PLATFORM_URL ?? "http://127.0.0.1:5173/");
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDist = resolve(projectRoot, "apps/web/dist");

const teacherRoutes = ["/teacher", "/teacher/accounts", "/teacher/classes", "/teacher/lessons", "/teacher/live", "/teacher/reports"];
const lightModes = ["overview", "dispersion", "straight", "reflection", "refraction", "color-mix", "celestial", "plane-mirror", "curved-mirror", "invisible-light", "magnifier", "bench", "camera", "eye", "correction", "instruments"];
const scienceModules = {
  sound: ["sound-medium", "sound-features", "sound-noise", "sound-echo"],
  mechanics: ["mechanics-speed", "mechanics-friction", "mechanics-lever", "mechanics-pressure", "mechanics-buoyancy"],
  circuit: ["circuit-basic", "circuit-ohm", "circuit-power", "circuit-magnet"],
  thermal: ["thermal-thermometer", "thermal-boiling", "thermal-melting", "thermal-evaporation"],
  measurement: ["measurement-balance", "measurement-mass-volume", "measurement-density", "measurement-liquid-density"]
};

const routes = [
  "/", "/student", "/student/notebook", "/student/textbook", "/lab/lens", "/student/explore/lens",
  ...teacherRoutes,
  ...lightModes.map((mode) => `/student/explore/light${mode === "overview" ? "" : `?mode=${mode}`}`),
  ...Object.entries(scienceModules).flatMap(([field, modules]) => [
    `/student/explore/${field}`,
    ...modules.map((module) => `/student/explore/${field}?module=${module}`)
  ])
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function walk(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function fetchChecked(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, baseUrl), { headers: { accept: "text/html,application/json" }, signal: AbortSignal.timeout(8_000), cache: "no-store" });
  assert(response.status === expectedStatus, `${path} 返回 ${response.status}，预期 ${expectedStatus}`);
  return response;
}

const pageResults = await Promise.all(routes.map(async (route) => {
  const response = await fetchChecked(route);
  const html = await response.text();
  assert(response.headers.get("content-type")?.includes("text/html"), `${route} 未返回网页内容`);
  assert(html.includes("id=\"root\"") && html.includes("格物实验室"), `${route} 返回的不是平台应用外壳`);
  return html;
}));

const indexHtml = pageResults[0];
const assetPaths = [...indexHtml.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
assert(assetPaths.length >= 3, "首页关键静态资源引用不完整");
await Promise.all(assetPaths.map(async (asset) => {
  const response = await fetchChecked(asset);
  assert((await response.arrayBuffer()).byteLength > 0, `静态资源为空：${asset}`);
}));

const routeCodeAssets = (await walk(resolve(webDist, "assets")))
  .filter((file) => /\.(?:js|css)$/.test(file))
  .map((file) => relative(webDist, file).split("\\").join("/"));
await Promise.all(routeCodeAssets.map(async (asset) => {
  const response = await fetchChecked(asset);
  assert((await response.arrayBuffer()).byteLength > 0, `页面代码资源为空：${asset}`);
}));

const healthResponse = await fetchChecked("api/health");
const health = await healthResponse.json();
assert(health.data?.status === "ok", "后台健康状态异常");
assert(["sqlite", "postgresql"].includes(health.data?.database), "教学数据库未就绪");
assert(health.data?.compatibility === "desktop-managed-accounts-v1", "前后端版本不兼容");
assert(health.data?.capabilities?.includes("managed-teacher-accounts"), "管理员账号能力未加载");

const protectedResponse = await fetchChecked("api/auth/me", 401);
const protectedPayload = await protectedResponse.json();
assert(protectedPayload.error?.code === "AUTH_REQUIRED", "后台鉴权通道返回异常");

console.log(`✓ 平台开机自检通过：${routes.length} 个页面入口、${routeCodeAssets.length} 个页面代码资源、同源 API 与 ${health.data.database} 均正常`);
