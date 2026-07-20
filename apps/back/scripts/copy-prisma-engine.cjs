const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const ENGINE =
  process.platform === "win32"
    ? "query_engine-windows.dll.node"
    : "libquery_engine-rhel-openssl-3.0.x.so.node";
const root = path.join(__dirname, "..");
const monorepoRoot = path.join(root, "../..");

const sources = [
  path.join(monorepoRoot, "node_modules", ".prisma", "client", ENGINE),
  path.join(monorepoRoot, "node_modules", "@prisma", "client", ENGINE),
  path.join(root, "node_modules", ".prisma", "client", ENGINE),
  path.join(root, "node_modules", "@prisma", "client", ENGINE),
];

const source = sources.find((candidate) => existsSync(candidate));

if (!source) {
  console.error(
    `[copy-prisma-engine] Engine not found. Searched:\n${sources
      .map((s) => `  - ${s}`)
      .join("\n")}`
  );
  process.exit(1);
}

const destinations = [
  path.join(root, "dist", ENGINE),
  path.join(root, ENGINE),
  path.join(root, ".prisma", "client", ENGINE),
];

for (const destination of destinations) {
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  console.log(`[copy-prisma-engine] ${source} -> ${destination}`);
}
