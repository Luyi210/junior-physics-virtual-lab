import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, link, stat, realpath } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createSourceRelease, RELEASE_FILES, runReleaseCommand } from "./create-release.mjs";

const workspaces = ["apps/api", "apps/web", "apps/optics-research", "packages/contracts", "packages/harness", "packages/knowledge", "packages/physics"];
const execute = promisify(execFile);
async function put(root, path, contents = "export {};\n") {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents);
}
async function fixture(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "physics-source-release-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourceRoot = join(directory, "workspace");
  await mkdir(sourceRoot);
  for (const path of RELEASE_FILES) await put(sourceRoot, path, "{}\n");
  await put(sourceRoot, "package.json", JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }));
  await put(sourceRoot, "package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: Object.fromEntries(workspaces.map((path) => [path, {}])) }));
  for (const path of workspaces) {
    await put(sourceRoot, `${path}/package.json`, JSON.stringify({ name: `@physics-lab/${path.split("/")[1]}`, type: "module" }));
    await put(sourceRoot, `${path}/src/index.ts`);
  }
  for (const path of [
    "apps/api/src/server.js", "apps/web/src/main.tsx", "apps/optics-research/src/main.tsx",
    "scripts/serve-render.mjs", "scripts/serve-web.mjs", "scripts/lib/api-proxy-timeout.mjs",
    "scripts/check-web-build.mjs", "scripts/check-architecture.mjs", "scripts/prepare-sites-build.mjs", "scripts/sites-worker.js",
    "deploy/linux/preflight.mjs", "deploy/linux/physics-lab.service", "deploy/linux/environment.example",
  ]) await put(sourceRoot, path);
  return { directory, sourceRoot, outputRoot: join(directory, "releases") };
}

test("copies all seven workspace sources, untracked changes and public assets with verifiable hashes", async (t) => {
  const input = await fixture(t);
  await put(input.sourceRoot, "apps/web/src/untracked-new-feature.ts", "export const title = '新源码';\n");
  await put(input.sourceRoot, "apps/web/public/assets/lili/corgi-01.webp", Buffer.from([0, 1, 127, 255]));
  await put(input.sourceRoot, "config/knowledge/rag-evaluation-v2.json", "[]");
  await put(input.sourceRoot, "config/deepseek-harness/lili.cordis.patch.yml", "plugins: {}\n");
  const result = await createSourceRelease({ ...input, releaseId: "review-1" });
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  assert.deepEqual(manifest.workspacePaths, workspaces);
  assert.equal(manifest.kind, "physics-lab-source-release");
  assert.equal(manifest.fileCount, manifest.files.length);
  for (const record of manifest.files) {
    const original = await readFile(join(input.sourceRoot, record.path));
    const copied = await readFile(join(result.sourceDirectory, record.path));
    assert.deepEqual(copied, original);
    assert.equal(record.bytes, copied.length);
    assert.equal(record.sha256, createHash("sha256").update(copied).digest("hex"));
  }
  for (const path of ["apps/web/src/untracked-new-feature.ts", "apps/web/public/assets/lili/corgi-01.webp", "scripts/lib/api-proxy-timeout.mjs", "config/deepseek-harness/lili.cordis.patch.yml"]) {
    assert.ok(manifest.files.some((record) => record.path === path), path);
  }
  assert.equal(manifest.totalBytes, manifest.files.reduce((sum, record) => sum + record.bytes, 0));
  assert.deepEqual(manifest.buildEnvironment, { VITE_API_URL: "/api", VITE_DEMO_ONLY: "false" });
  assert.equal((await stat(result.directory)).mode & 0o077, 0);
  await put(input.sourceRoot, "apps/web/src/untracked-new-feature.ts", "later edit");
  assert.equal(await readFile(join(result.sourceDirectory, "apps/web/src/untracked-new-feature.ts"), "utf8"), "export const title = '新源码';\n");
});

test("private files, databases, artifacts, unlisted trees and links never enter the release", async (t) => {
  const input = await fixture(t);
  const excluded = [
    ".env", ".env.production", ".runtime/private.json", ".git/config", ".npmrc", "docs/history.md",
    "apps/api/data/classroom.sqlite", "apps/api/src/old.sqlite", "apps/api/src/live.sqlite-wal", "apps/api/src/live.sqlite-shm",
    "apps/api/src/dump.sql", "apps/api/src/credentials.json", "apps/api/src/service-account.json", "apps/api/src/server.key",
    "apps/api/src/environment.env", "apps/api/src/app.log", "apps/api/src/export.backup", "apps/api/src/id_ed25519",
    "apps/web/.env.local", "apps/web/src/.env.staging", "apps/web/src/secrets/api.json",
    "apps/web/src/node_modules/module.js", "apps/web/src/build/bundle.js", "apps/web/src/dist/bundle.js",
    "apps/web/src/.cache/config.json", "apps/web/src/model.tsbuildinfo", "apps/web/dist/index.html",
    "config/deepseek-harness/foo.local", "config/deepseek-harness/override.local.json",
    "config/deepseek-harness/private.local/patch.yml",
    "node_modules/dependency/index.js", "dist/client/index.html", "scripts/backup/record.json", "deploy/linux/private.pem",
  ];
  for (const path of excluded) await put(input.sourceRoot, path, "PRIVATE_FIXTURE_CONTENT");
  const outside = join(input.directory, "outside.json");
  await writeFile(outside, "EXTERNAL_PRIVATE_FIXTURE");
  await symlink(outside, join(input.sourceRoot, "apps/web/src/linked.json"));
  await symlink(join(input.directory, "nonexistent-secret"), join(input.sourceRoot, "apps/web/src/broken.json"));
  await symlink(input.directory, join(input.sourceRoot, "apps/web/src/linked-directory"));
  await link(outside, join(input.sourceRoot, "apps/web/src/hard-link.json"));
  const result = await createSourceRelease(input);
  for (const path of excluded.concat(["apps/web/src/linked.json", "apps/web/src/broken.json", "apps/web/src/hard-link.json"])) {
    assert.ok(!result.manifest.files.some((record) => record.path === path), path);
  }
  assert.ok(!result.manifest.files.some((record) => record.path.includes("linked-directory")));
  for (const record of result.manifest.files) {
    assert.doesNotMatch((await readFile(join(result.sourceDirectory, record.path))).toString(), /PRIVATE_FIXTURE/);
  }
  assert.ok(result.manifest.files.some((record) => record.path === "deploy/linux/environment.example"));
});

test("missing or linked required workspace files fail before an output release is created", async (t) => {
  const input = await fixture(t);
  const entry = join(input.sourceRoot, "apps/api/src/server.js");
  await rm(entry);
  await assert.rejects(createSourceRelease(input), /Required release file.*server[.]js/);
  const outside = join(input.directory, "replacement.js");
  await writeFile(outside, "throw new Error('must not execute')");
  await symlink(outside, entry);
  await assert.rejects(createSourceRelease(input), /Required release file.*server[.]js/);
  await assert.rejects(stat(input.outputRoot), { code: "ENOENT" });
});

test("rejects nested output, path traversal, output symlinks and overwriting an earlier release", async (t) => {
  const input = await fixture(t);
  for (const outputRoot of [input.sourceRoot, input.directory, join(input.sourceRoot, "scripts/releases"), join(input.sourceRoot, "apps/web")]) {
    await assert.rejects(createSourceRelease({ ...input, outputRoot }), /outside all included source trees/);
  }
  for (const releaseId of ["../escape", "/absolute", "with/slash", "with\\slash", ""]) {
    await assert.rejects(createSourceRelease({ ...input, releaseId }), /Release id/);
  }
  const outside = join(input.directory, "outside-output");
  await mkdir(outside);
  await symlink(outside, input.outputRoot);
  await assert.rejects(createSourceRelease(input), /symlinks/);
  assert.deepEqual(await readdir(outside), []);
  await rm(input.outputRoot);
  const first = await createSourceRelease({ ...input, releaseId: "fixed" });
  const original = await readFile(first.manifestPath);
  await assert.rejects(createSourceRelease({ ...input, releaseId: "fixed" }), { code: "EEXIST" });
  assert.deepEqual(await readFile(first.manifestPath), original);
});

test("a changed workspace layout is refused rather than silently packaging an incomplete lockfile", async (t) => {
  const input = await fixture(t);
  const lockPath = join(input.sourceRoot, "package-lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  lock.packages["apps/new-product"] = {};
  await writeFile(lockPath, JSON.stringify(lock));
  await assert.rejects(createSourceRelease(input), /Lockfile workspace layout changed/);
  await assert.rejects(stat(input.outputRoot), { code: "ENOENT" });
});

test("parallel default releases remain unique and the default output is excluded from future packages", async (t) => {
  const { sourceRoot } = await fixture(t);
  const [a, b] = await Promise.all([createSourceRelease({ sourceRoot }), createSourceRelease({ sourceRoot })]);
  assert.notEqual(a.directory, b.directory);
  assert.equal(dirname(a.directory), join(sourceRoot, ".runtime/deployment-releases"));
  assert.deepEqual(a.manifest.files, b.manifest.files);
  const c = await createSourceRelease({ sourceRoot });
  assert.deepEqual(c.manifest.files, a.manifest.files);
  assert.ok(c.manifest.files.every((record) => !record.path.startsWith(".runtime/")));
});

test("CLI creates only the requested local fixture and rejects ambiguous flags", async (t) => {
  const input = await fixture(t);
  for (const args of [["--upload"], ["toString", "unexpected"], ["constructor", "unexpected"], ["--source"], ["--source", input.sourceRoot, "--source", input.sourceRoot]]) {
    await assert.rejects(runReleaseCommand(args), /Invalid release arguments/);
  }
  assert.match((await runReleaseCommand(["--help"])).help, /never uploads/);
  const script = fileURLToPath(new URL("./create-release.mjs", import.meta.url));
  const { stdout } = await execute(process.execPath, [script, "--source", input.sourceRoot, "--output", input.outputRoot, "--id", "cli-fixture"], { timeout: 10_000 });
  const report = JSON.parse(stdout);
  assert.equal(report.ok, true);
  assert.equal(report.directory, join(input.outputRoot, "cli-fixture"));
  assert.ok(report.fileCount > 25);
  assert.deepEqual(await readdir(report.directory), ["manifest.json", "source"]);
});
