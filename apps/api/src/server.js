import { loadConfig } from "./config.js";
import { openDatabase } from "./database.js";
import { createApiServer } from "./app.js";

const config = loadConfig();
const db = openDatabase(config);
const server = createApiServer({ db, config });

server.listen(config.port, config.host, () => {
  console.log(`Physics Lab API running at http://${config.host}:${config.port}/api`);
  console.log("Demo teacher: teacher@physics.local / Teacher123!");
});

function shutdown(signal) {
  console.log(`\n${signal}: closing Physics Lab API`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
