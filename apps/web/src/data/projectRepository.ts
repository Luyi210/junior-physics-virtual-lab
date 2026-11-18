import type { ExperimentProject } from "@physics-lab/contracts";
import { localStores, openLocalDatabase } from "./localDatabase";

export interface ProjectGateway {
  save<T>(project: ExperimentProject<T>): Promise<void>;
  find<T>(id: string): Promise<ExperimentProject<T> | undefined>;
}

export const localProjectRepository: ProjectGateway = {
  async save(project) {
    const database = await openLocalDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(localStores.projects, "readwrite");
      transaction.objectStore(localStores.projects).put(project);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  },

  async find<T>(id: string) {
    const database = await openLocalDatabase();
    const project = await new Promise<ExperimentProject<T> | undefined>((resolve, reject) => {
      const request = database.transaction(localStores.projects, "readonly").objectStore(localStores.projects).get(id);
      request.onsuccess = () => resolve(request.result as ExperimentProject<T> | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return project;
  }
};
