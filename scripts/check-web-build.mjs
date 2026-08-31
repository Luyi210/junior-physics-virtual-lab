import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDist = resolve(projectRoot, "apps/web/dist");
const html = await readFile(resolve(webDist, "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Web build check failed: ${message}`);
}

assert(html.includes("格物实验室"), "index.html title is missing");
assert(!/modulepreload[^>]+(?:three-core|react-three)/i.test(html), "homepage preloads the optional Three.js stack");
assert(/modulepreload[^>]+react-core/i.test(html), "React runtime preload is missing");

async function walk(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk(webDist);
assert(!files.some((file) => file.endsWith(".map")), "public build contains source maps");

const initialReferences = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
assert(initialReferences.length >= 3, "initial assets could not be identified");

let compressedBytes = 0;
for (const reference of initialReferences) {
  const file = resolve(webDist, reference);
  assert((await stat(file)).isFile(), `missing initial asset ${reference}`);
  compressedBytes += gzipSync(await readFile(file)).byteLength;
}

const compressedKilobytes = compressedBytes / 1024;
assert(compressedKilobytes < 300, `homepage initial assets are ${compressedKilobytes.toFixed(1)} KiB gzip (limit: 300 KiB)`);
console.log(`✓ Web build acceptance: ${compressedKilobytes.toFixed(1)} KiB gzip, no eager Three.js, no source maps`);
