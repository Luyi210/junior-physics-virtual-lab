import { parseHarnessSession } from "@physics-lab/harness";
import type { HarnessSession } from "@physics-lab/harness";
import { localStores, openLocalDatabase } from "./localDatabase";

export interface HarnessSessionGateway {
  save(session: HarnessSession): Promise<void>;
  find(id: string): Promise<HarnessSession | undefined>;
  findAll(): Promise<HarnessSession[]>;
}

export const localHarnessSessionRepository: HarnessSessionGateway = {
  async save(session) {
    const database = await openLocalDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(localStores.harnessSessions, "readwrite");
      transaction.objectStore(localStores.harnessSessions).put(session);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  },

  async find(id) {
    const database = await openLocalDatabase();
    const rawSession = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(localStores.harnessSessions, "readonly").objectStore(localStores.harnessSessions).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return parseHarnessSession(rawSession);
  },

  async findAll() {
    const database = await openLocalDatabase();
    const rawSessions = await new Promise<unknown[]>((resolve, reject) => {
      const request = database.transaction(localStores.harnessSessions, "readonly").objectStore(localStores.harnessSessions).getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rawSessions.map(parseHarnessSession).filter((session): session is HarnessSession => Boolean(session));
  }
};
