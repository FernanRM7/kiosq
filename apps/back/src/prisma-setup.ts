import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WINDOWS_ENGINE = "query_engine-windows.dll.node";
const LINUX_ENGINE = "libquery_engine-rhel-openssl-3.0.x.so.node";
const preferredEngine =
  process.platform === "win32" ? WINDOWS_ENGINE : LINUX_ENGINE;
const fallbackEngine =
  process.platform === "win32" ? LINUX_ENGINE : WINDOWS_ENGINE;
// Webpack + Nest watch still need a filesystem path here.
// eslint-disable-next-line unicorn/prefer-import-meta-properties
const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Prisma 6 uses the *library* engine by default (loadLibrary).
 * PRISMA_QUERY_ENGINE_BINARY is ignored — use PRISMA_QUERY_ENGINE_LIBRARY.
 *
 * On Vercel the function entry is api/index.js (monorepo root). NFT does not
 * trace native .so.node files, so vercel.json must includeFiles the engines
 * and we point Prisma at the first path that actually exists at runtime.
 */
const engineRoots = [
  // Next to the bundle (apps/back/dist or apps/back/src during dev)
  currentDir,
  // Build output from the backend package. Prefer this over the app root so
  // local builds can still boot even if the root engine copy is locked.
  path.join(process.cwd(), "apps", "back", "dist"),
  // App root (Prisma searches /var/task/apps/back)
  path.join(currentDir, ".."),
  // Generated client (hoisted monorepo node_modules)
  path.join(process.cwd(), "node_modules", ".prisma", "client"),
  path.join(process.cwd(), "node_modules", "@prisma", "client"),
  // Nested from apps/back cwd variants
  path.join(process.cwd(), "apps", "back"),
  path.join(process.cwd(), ".prisma", "client"),
];

const candidates = [
  ...engineRoots.map((root) => path.join(root, preferredEngine)),
  ...engineRoots.map((root) => path.join(root, fallbackEngine)),
];

if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  candidates.push(process.env.PRISMA_QUERY_ENGINE_LIBRARY);
}

const resolved = candidates.find((candidate) => existsSync(candidate));

if (resolved) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = resolved;
} else if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  // Last resort: default next to bundle (includeFiles should place it here)
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    currentDir,
    preferredEngine
  );
}
