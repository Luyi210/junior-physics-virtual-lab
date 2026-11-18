#!/usr/bin/env node
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const workspacePaths = [
  "apps/api", "apps/web", "apps/optics-research",
  "packages/contracts", "packages/harness", "packages/knowledge", "packages/physics",
];
// Deliberate allowlist, independent of Git status. Changes to workspace layout
// require reviewing this list; never copy the checkout or a user's home wholesale.
export const RELEASE_FILES = Object.freeze([
  "package.json", "package-lock.json", "render.yaml", ".gitignore",
  ...workspacePaths.map((path) => `${path}/package.json`),
  "apps/web/index.html", "apps/web/vite.config.ts", "apps/web/tsconfig.json",
  "apps/web/tsconfig.app.json", "apps/web/tsconfig.node.json",
  "apps/optics-research/index.html", "apps/optics-research/vite.config.ts", "apps/optics-research/tsconfig.json",
  "packages/harness/tsconfig.json", "packages/knowledge/tsconfig.json", "packages/physics/tsconfig.json",
]);
export const RELEASE_DIRECTORIES = Object.freeze([
  ...workspacePaths.map((path) => `${path}/src`),
  "apps/api/test", "apps/web/public",
  "config/deepseek-harness", "config/knowledge", "scripts", "deploy/linux",
]);
const requiredFiles = [
  ...RELEASE_FILES.filter((path) => !["render.yaml", ".gitignore"].includes(path)),
  "apps/api/src/server.js", "apps/web/src/main.tsx", "apps/optics-research/src/main.tsx",
  ...workspacePaths.filter((path) => path.startsWith("packages/")).map((path) => `${path}/src/index.ts`),
  "scripts/serve-render.mjs", "scripts/serve-web.mjs", "scripts/lib/api-proxy-timeout.mjs",
  "scripts/check-web-build.mjs", "scripts/check-architecture.mjs", "scripts/prepare-sites-build.mjs", "scripts/sites-worker.js",
  "deploy/linux/preflight.mjs", "deploy/linux/physics-lab.service", "deploy/linux/environment.example",
];
const excludedNames = new Set([
  "node_modules", "dist", "build", "coverage", "tmp", "temp", "cache", "logs", "log",
  "backups", "backup", "credentials", "secrets", "private", "__pycache__",
]);

function excluded(path) {
  const parts = path.split("/");
  return parts.some((part) => {
    const lower = part.toLowerCase();
    if (path !== ".gitignore" && (part.startsWith(".") || part.startsWith("~"))) return true;
    return excludedNames.has(lower)
      || /(?:^|[._-])(?:credentials?|secrets?|private[-_]?key|service[-_]?account)(?:[._-]|$)/i.test(part)
      || /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:[.]|$)/i.test(part)
      || /(?:^|[.])env(?:[.-]|$)/i.test(part)
      || /[.]local(?:[.]|$)/i.test(part)
      || /[.](?:sqlite3?|db3?)(?:[.-]|$)/i.test(part)
      || /(?:-wal|-shm|-journal)$/i.test(part)
      || /[.](?:sql|dump|bak|backup|log|pid|sock|pem|key|p12|pfx|der|jks|keystore|tsbuildinfo|map|zip|tar|tgz|gz)$/i.test(part);
  });
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function inspect(root, path) {
  let current = root;
  const parts = path.split("/");
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index]);
    let info;
    try { info = await lstat(current); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory())) return null;
    if (index === parts.length - 1) return info;
  }
  return null;
}

async function collectFiles(root) {
  const files = new Map();
  async function walk(path) {
    // Reject names before opening files or descending into excluded directories.
    if (excluded(path)) return;
    if (path.includes("\\")) throw new Error("Source contains a non-portable path; review it before packaging.");
    const info = await inspect(root, path);
    if (!info) return;
    if (info.isDirectory()) {
      for (const name of (await readdir(join(root, path))).sort()) await walk(`${path}/${name}`);
    } else if (info.isFile() && info.nlink === 1) files.set(path, info);
  }
  for (const path of RELEASE_FILES) {
    const info = await inspect(root, path);
    if (!excluded(path) && info?.isFile() && info.nlink === 1) files.set(path, info);
  }
  for (const path of RELEASE_DIRECTORIES) await walk(path);
  for (const path of requiredFiles) if (!files.has(path)) throw new Error(`Required release file is missing or unsafe: ${path}`);
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b, "en")));
}

function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size
    && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs && b.isFile() && b.nlink === 1;
}

async function readSource(root, path, expected) {
  const current = await inspect(root, path);
  if (!current || !sameFile(expected, current)) throw new Error(`Source changed before copying: ${path}`);
  const absolute = join(root, path);
  if (!inside(root, absolute) || await realpath(absolute) !== absolute) throw new Error(`Unsafe source path: ${path}`);
  const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!sameFile(expected, await handle.stat())) throw new Error(`Source changed while opening: ${path}`);
    const bytes = await handle.readFile();
    if (!sameFile(expected, await handle.stat())) throw new Error(`Source changed while reading: ${path}`);
    return bytes;
  } finally { await handle.close(); }
}

async function validateWorkspaces(root, files) {
  const readJson = async (path) => {
    try { return JSON.parse((await readSource(root, path, files.get(path))).toString("utf8")); }
    catch { throw new Error(`Invalid or changing workspace manifest: ${path}`); }
  };
  const pkg = await readJson("package.json");
  const lock = await readJson("package-lock.json");
  if (JSON.stringify(pkg.workspaces) !== JSON.stringify(["apps/*", "packages/*"])) {
    throw new Error("Workspace patterns changed; review the source-release allowlist first.");
  }
  const actual = Object.keys(lock.packages ?? {}).filter((path) => /^(apps|packages)\//.test(path)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...workspacePaths].sort())) {
    throw new Error("Lockfile workspace layout changed; review the source-release allowlist first.");
  }
  for (const path of workspacePaths) {
    const workspace = await readJson(`${path}/package.json`);
    if (workspace.name !== `@physics-lab/${path.split("/")[1]}`) throw new Error(`Unexpected workspace name: ${path}`);
  }
}

async function privateDirectory(path) {
  const parent = dirname(path);
  if (parent !== path) await privateDirectory(parent);
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Output directory must not contain symlinks or non-directories.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    try { await mkdir(path, { mode: 0o700 }); }
    catch (creationError) {
      if (creationError.code !== "EEXIST") throw creationError;
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Output directory changed during creation.");
    }
  }
}

/** Copy an auditable source snapshot only. No Git, network, install, build, DB
 * access, credentials creation, service control or upload takes place here.
 * Exclusion rules protect named private files, not secrets embedded in otherwise
 * allowed source code; the caller must review the manifest before uploading.
 */
export async function createSourceRelease({ sourceRoot, outputRoot, releaseId } = {}) {
  const root = await realpath(resolve(sourceRoot ?? fileURLToPath(new URL("../..", import.meta.url))));
  const output = resolve(outputRoot ?? join(root, ".runtime/deployment-releases"));
  const id = releaseId ?? `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${randomUUID()}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id)) throw new Error("Release id must contain only safe letters, digits, hyphens and underscores.");
  if (inside(output, root) || RELEASE_DIRECTORIES.some((path) => inside(join(root, path), output) || inside(output, join(root, path)))) {
    throw new Error("Output must be outside all included source trees; use .runtime/deployment-releases or a separate directory.");
  }
  const files = await collectFiles(root);
  await validateWorkspaces(root, files);
  await privateDirectory(output);
  const directory = join(output, id);
  // Never merge with or overwrite an earlier/partial release.
  await mkdir(directory, { mode: 0o700 });
  const sourceDirectory = join(directory, "source");
  await mkdir(sourceDirectory, { mode: 0o700 });
  const records = [];
  for (const [path, info] of files) {
    const bytes = await readSource(root, path, info);
    const target = join(sourceDirectory, path);
    if (!inside(sourceDirectory, target)) throw new Error("Release path escaped its source directory.");
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, bytes, { flag: "wx", mode: info.mode & 0o111 ? 0o700 : 0o600 });
    records.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const after = await collectFiles(root);
  if (after.size !== files.size || [...files].some(([path, info]) => !after.has(path) || !sameFile(info, after.get(path)))) {
    throw new Error("Source tree changed during copying; incomplete output retained without a success manifest.");
  }
  const manifest = {
    formatVersion: 1, kind: "physics-lab-source-release", releaseId: id,
    createdAt: new Date().toISOString(), nodeVersion: process.versions.node,
    sourceDirectory: "source", fileCount: records.length,
    totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
    workspacePaths: [...workspacePaths],
    allowlist: { files: [...RELEASE_FILES], directories: [...RELEASE_DIRECTORIES] },
    buildEnvironment: { VITE_API_URL: "/api", VITE_DEMO_ONLY: "false" },
    notice: "Source only; not installed, built, deployed or secret-scanned. Review before upload. Runtime environment/database files are excluded; public configuration templates are included.",
    files: records,
  };
  const manifestPath = join(directory, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return { directory, sourceDirectory, manifestPath, manifest };
}

export async function runReleaseCommand(args) {
  if (args.length === 1 && args[0] === "--help") return { help: "node deploy/linux/create-release.mjs [--source <workspace>] [--output <release-root>] [--id <unique-id>]\nCreates source/ and manifest.json locally; never uploads, installs, builds or starts services." };
  const keys = { "--source": "sourceRoot", "--output": "outputRoot", "--id": "releaseId" };
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!Object.hasOwn(keys, args[index])) throw new Error("Invalid release arguments; use --help.");
    const key = keys[args[index]], value = args[index + 1];
    if (!key || options[key] !== undefined || !value || value.startsWith("--")) throw new Error("Invalid release arguments; use --help.");
    options[key] = value;
  }
  const result = await createSourceRelease(options);
  return { ok: true, directory: result.directory, manifestPath: result.manifestPath, fileCount: result.manifest.fileCount, totalBytes: result.manifest.totalBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runReleaseCommand(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(`Source release was not completed: ${error.message}`);
    process.exitCode = 1;
  });
}
