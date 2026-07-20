import * as path from "node:path";

const engineFileName = "libquery_engine-rhel-openssl-3.0.x.so.node";

if (!process.env.PRISMA_QUERY_ENGINE_BINARY) {
  process.env.PRISMA_QUERY_ENGINE_BINARY = path.join(
    __dirname,
    engineFileName
  );
}
