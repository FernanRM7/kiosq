const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const WINDOWS_ENGINE = "query_engine-windows.dll.node";
const LINUX_ENGINE = "libquery_engine-rhel-openssl-3.0.x.so.node";
const preferredEngine =
  process.platform === "win32" ? WINDOWS_ENGINE : LINUX_ENGINE;
const fallbackEngine =
  process.platform === "win32" ? LINUX_ENGINE : WINDOWS_ENGINE;
const root = path.join(__dirname, "..");
const monorepoRoot = path.join(root, "../..");

const sourceRoots = [
  path.join(monorepoRoot, "node_modules", ".prisma", "client"),
  path.join(monorepoRoot, "node_modules", "@prisma", "client"),
  path.join(root, "node_modules", ".prisma", "client"),
  path.join(root, "node_modules", "@prisma", "client"),
];

const sources = [
  ...sourceRoots.map((sourceRoot) => path.join(sourceRoot, preferredEngine)),
  ...sourceRoots.map((sourceRoot) => path.join(sourceRoot, fallbackEngine)),
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
  path.join(root, "dist", preferredEngine),
  path.join(root, preferredEngine),
  path.join(root, ".prisma", "client", preferredEngine),
];

for (const destination of destinations) {
  mkdirSync(path.dirname(destination), { recursive: true });
  try {
    copyFileSync(source, destination);
    console.log(`[copy-prisma-engine] ${source} -> ${destination}`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const { code } = error;
      if (code === "EBUSY" || code === "EPERM") {
        console.warn(
          `[copy-prisma-engine] Skipped locked destination ${destination}`
        );
        continue;
      }
    }

    throw error;
  }
}
