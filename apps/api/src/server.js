import { loadConfig } from "./config.js";
import { openDatabase } from "./database.js";
import { createApiServer } from "./app.js";
import { createGuangguangService } from "./guangguang.js";

const config = loadConfig();

if (!config.seedDemoData) {
  if (!config.bootstrapAdminEmail || !/^\S+@\S+\.\S+$/.test(config.bootstrapAdminEmail)) {
    throw new Error("PHYSICS_BOOTSTRAP_ADMIN_EMAIL 必须设置为有效的管理员邮箱");
  }
  if (config.bootstrapAdminPassword.length < 12) {
    throw new Error("PHYSICS_BOOTSTRAP_ADMIN_PASSWORD 至少需要 12 个字符");
  }
}

const db = await openDatabase(config);
const guangguang = createGuangguangService(config);
const server = createApiServer({ db, config, guangguang });

server.listen(config.port, config.host, () => {
  console.log(`Physics Lab API running at http://${config.host}:${config.port}/api`);
  console.log(config.guangguangEnabled && config.deepseekApiKey
    ? `Guangguang AI: ${config.guangguangProvider}/${config.guangguangModel}`
    : "Guangguang AI: local rules fallback (set DEEPSEEK_API_KEY to enable)");
  if (config.seedDemoData) console.log("Demo teacher: teacher@physics.local / Teacher123!");
  else console.log(`Bootstrap administrator: ${config.bootstrapAdminEmail}`);
});

function shutdown(signal) {
  console.log(`\n${signal}: closing Physics Lab API`);
  server.close(async () => {
    await guangguang.close();
    await db.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
