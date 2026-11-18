import { openDatabase } from "./database.js";
import { createApiServer } from "./app.js";
import { createGuangguangService } from "./guangguang.js";
import { createVectorKnowledgeService } from "./vector-knowledge.js";
import { createLiliService } from "./lili.js";
import { initializationMessage } from "./database-initialization.js";

/** Start after the adapter has committed or preserved database state. */
export async function startApiRuntime(config, dependencies = {}) {
  const factories = { openDatabase, createApiServer, createGuangguangService, createVectorKnowledgeService, createLiliService, ...dependencies };
  const logger = dependencies.logger ?? console;
  let db, vectorKnowledge, guangguang, lili, server;
  let closing;
  async function cleanup() {
    const errors = [];
    if (server?.listening) await new Promise((resolve) => server.close((error) => { if (error) errors.push(error); resolve(); }));
    // A failed service must not prevent closing the other resources or DB.
    for (const resource of [lili, guangguang, vectorKnowledge, db]) {
      try { await resource?.close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Physics Lab API resource cleanup failed");
  }
  const close = () => closing ??= cleanup();
  try {
    db = await factories.openDatabase(config);
    const databaseMessage = initializationMessage(db.initialization);
    vectorKnowledge = factories.createVectorKnowledgeService(config);
    await vectorKnowledge.initialize();
    guangguang = factories.createGuangguangService(config, { vectorKnowledge });
    lili = factories.createLiliService(config);
    server = factories.createApiServer({ db, config, guangguang, lili });
    await new Promise((resolve, reject) => {
      const onError = (error) => { server.off("listening", onListening); reject(error); };
      const onListening = () => { server.off("error", onError); resolve(); };
      server.once("error", onError); server.once("listening", onListening);
      try { server.listen(config.port, config.host); }
      catch (error) { server.off("error", onError); server.off("listening", onListening); reject(error); }
    });
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : config.port;
    logger.log(`Physics Lab API running at http://${config.host}:${port}/api`);
    logger.log(databaseMessage);
    logger.log(config.guangguangEnabled && config.deepseekApiKey
      ? `Guangguang AI: ${config.guangguangProvider}/${config.guangguangModel}`
      : "Guangguang AI: local rules fallback (set DEEPSEEK_API_KEY to enable)");
    const vectorStatus = vectorKnowledge.status();
    logger.log(vectorStatus.enabled
      ? `Guangguang RAG: ${vectorStatus.mode} (${vectorStatus.indexedChunks}/${vectorStatus.totalChunks} chunks ready)`
      : "Guangguang RAG: local KG fallback (set DATABASE_URL and SILICONFLOW_API_KEY to enable vectors)");
    return { server, initialization: db.initialization, close };
  } catch (error) {
    try { await close(); } catch { /* Preserve the startup cause after attempting every cleanup. */ }
    throw error;
  }
}
