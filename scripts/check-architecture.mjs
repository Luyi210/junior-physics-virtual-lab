import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, allowJs: true };
const sourceRoots = ["apps/web/src", "apps/api/src", "apps/optics-research/src", "packages"];
const errors = [];
const graph = new Map();
const display = (file) => relative(root, file).replaceAll("\\", "/");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    if (["node_modules", "dist"].includes(item.name)) return [];
    const file = resolve(directory, item.name);
    return item.isDirectory() ? walk(file) : /\.(?:ts|tsx|js|mjs)$/.test(file) && !/\.test\./.test(file) ? [file] : [];
  });
}

function checkEdge(file, specifier, runtime) {
  const result = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
  const target = result?.resolvedFileName;
  if (!target) {
    // Stylesheets are resolved by Vite rather than TypeScript.
    if (specifier.startsWith(".") && !existsSync(resolve(dirname(file), specifier))) errors.push(`${display(file)}: unresolved ${specifier}`);
    if (specifier.startsWith("@physics-lab/")) errors.push(`${display(file)}: missing workspace package ${specifier}`);
    return;
  }
  if (target.includes("/node_modules/")) return;
  const from = display(file), to = display(target);
  if (from.startsWith("packages/") && to.startsWith("apps/")) errors.push(`${from}: shared package imports application ${to}`);
  if (from.startsWith("apps/api/") && to.startsWith("apps/web/")) errors.push(`${from}: API imports frontend ${to}`);
  if (from.startsWith("apps/web/src/shared/") && /apps\/web\/src\/(features|app|data)\//.test(to)) errors.push(`${from}: shared UI imports a higher layer ${to}`);
  if (from.startsWith("apps/web/src/data/") && /apps\/web\/src\/(features|app|shared)\//.test(to)) errors.push(`${from}: data service imports UI ${to}`);
  if (from.startsWith("apps/web/src/features/") && to.startsWith("apps/web/src/app/")) errors.push(`${from}: feature imports application routing ${to}`);
  if (runtime) graph.get(file).add(resolve(target));
}

for (const file of sourceRoots.flatMap((name) => walk(resolve(root, name)))) {
  graph.set(file, new Set());
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      let runtime = !node.isTypeOnly;
      if (ts.isImportDeclaration(node) && node.importClause) {
        const clause = node.importClause;
        runtime = !clause.isTypeOnly;
        if (!clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) runtime &&= clause.namedBindings.elements.some((item) => !item.isTypeOnly);
      } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        runtime &&= node.exportClause.elements.some((item) => !item.isTypeOnly);
      }
      checkEdge(file, node.moduleSpecifier.text, runtime);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      // Validate lazy routes too; only eager imports participate in cycle checks.
      checkEdge(file, node.arguments[0].text, false);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const visited = new Set(), active = new Set(), stack = [];
function visit(file) {
  if (active.has(file)) {
    errors.push(`Runtime import cycle: ${[...stack.slice(stack.indexOf(file)), file].map(display).join(" -> ")}`);
    return;
  }
  if (visited.has(file) || !graph.has(file)) return;
  active.add(file); stack.push(file);
  for (const dependency of graph.get(file)) visit(dependency);
  stack.pop(); active.delete(file); visited.add(file);
}
for (const file of graph.keys()) visit(file);

if (errors.length) {
  console.error([...new Set(errors)].map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`✓ Architecture: ${graph.size} modules, valid layer boundaries, resolved local imports, no eager import cycles`);
}
