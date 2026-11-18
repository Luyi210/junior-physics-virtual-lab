import { loadConfig } from "./config.js";
import { startApiRuntime } from "./server-runtime.js";

const runtime = await startApiRuntime(loadConfig());
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: closing Physics Lab API`);
  try { await runtime.close(); process.exit(0); }
  catch { console.error("Physics Lab API cleanup did not finish successfully"); process.exit(1); }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
