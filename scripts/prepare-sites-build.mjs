import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDist = resolve(root, "apps/web/dist");
const output = resolve(root, "dist");
const workerSource = resolve(root, "scripts/sites-worker.js");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "server"), { recursive: true });
await cp(webDist, resolve(output, "client"), { recursive: true });
await writeFile(resolve(output, "server/index.js"), await readFile(workerSource));
