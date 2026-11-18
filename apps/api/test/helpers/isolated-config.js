import { loadConfig } from "../../src/config.js";

/** Test fixtures must never select a deployment database or inherit live provider credentials. */
export function isolatedSqliteConfig(overrides = {}) {
  return loadConfig({
    tokenSecret: "test-secret",
    allowedOrigins: ["http://127.0.0.1:5173"],
    seedDemoData: true,
    bootstrapAdminEmail: "",
    bootstrapAdminPassword: "",
    ...overrides,
    databaseUrl: "",
    databasePath: ":memory:",
    deepseekApiKey: "",
    siliconflowApiKey: "",
    guangguangEnabled: false,
    liliEnabled: false,
    vectorRagEnabled: false
  });
}
