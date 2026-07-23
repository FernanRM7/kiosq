import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

import { resolvePrismaDatasourceUrls } from "./src/lib/prisma-datasource";

// Capture explicit process overrides before dotenv fills the missing values.
// This prevents a local DATABASE_URL override from being combined with a
// remote DIRECT_URL loaded from .env during migration commands.
const injectedDatabaseUrl = process.env.DATABASE_URL;
const injectedDirectUrl = process.env.DIRECT_URL;

loadDotenv();

const datasource = resolvePrismaDatasourceUrls(
  {
    databaseUrl: injectedDatabaseUrl,
    directUrl: injectedDirectUrl,
  },
  {
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  }
);

export default defineConfig({
  datasource: {
    directUrl: datasource.directUrl,
    url: datasource.url,
  },
  engine: "classic",
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
});
