import { existsSync } from "node:fs";
import path from "node:path";

const ENGINE =
  process.platform === "win32"
    ? "query_engine-windows.dll.node"
    : "libquery_engine-rhel-openssl-3.0.x.so.node";

/**
 * Prisma 6 uses the *library* engine by default (loadLibrary).
 * PRISMA_QUERY_ENGINE_BINARY is ignored — use PRISMA_QUERY_ENGINE_LIBRARY.
 *
 * On Vercel the function entry is api/index.js (monorepo root). NFT does not
 * trace native .so.node files, so vercel.json must includeFiles the engines
 * and we point Prisma at the first path that actually exists at runtime.
 */
const candidates = [
  process.env.PRISMA_QUERY_ENGINE_LIBRARY,
  // Next to the webpack bundle (apps/back/dist)
  // eslint-disable-next-line unicorn/prefer-module
  path.join(__dirname, ENGINE),
  // App root (Prisma searches /var/task/apps/back)
  // eslint-disable-next-line unicorn/prefer-module
  path.join(__dirname, "..", ENGINE),
  // Generated client (hoisted monorepo node_modules)
  path.join(process.cwd(), "node_modules", ".prisma", "client", ENGINE),
  path.join(process.cwd(), "node_modules", "@prisma", "client", ENGINE),
  // Nested from apps/back cwd variants
  path.join(process.cwd(), "apps", "back", "dist", ENGINE),
  path.join(process.cwd(), "apps", "back", ENGINE),
  path.join(process.cwd(), ".prisma", "client", ENGINE),
].filter((value): value is string => value !== undefined && value !== null);

const resolved = candidates.find((candidate) => existsSync(candidate));

if (resolved) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = resolved;
} else if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  // Last resort: default next to bundle (includeFiles should place it here)
  // eslint-disable-next-line unicorn/prefer-module
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(__dirname, ENGINE);
}
