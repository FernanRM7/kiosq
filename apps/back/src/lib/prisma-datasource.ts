interface PrismaDatasourceEnvironment {
  readonly databaseUrl?: string;
  readonly directUrl?: string;
}

interface PrismaDatasourceUrls {
  readonly directUrl: string;
  readonly url: string;
}

const nonEmpty = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

/**
 * Keeps command-level URL overrides in one trust boundary.
 *
 * If a caller injects only DATABASE_URL or DIRECT_URL, Prisma uses that value
 * for both connections instead of silently filling the other one from .env.
 */
export const resolvePrismaDatasourceUrls = (
  injected: PrismaDatasourceEnvironment,
  loaded: PrismaDatasourceEnvironment
): PrismaDatasourceUrls => {
  const hasInjectedDatabaseUrl = injected.databaseUrl !== undefined;
  const hasInjectedDirectUrl = injected.directUrl !== undefined;
  const injectedDatabaseUrl = nonEmpty(injected.databaseUrl);
  const injectedDirectUrl = nonEmpty(injected.directUrl);
  const hasInjectedOverride = hasInjectedDatabaseUrl || hasInjectedDirectUrl;

  if (hasInjectedOverride) {
    if (
      (hasInjectedDatabaseUrl && !injectedDatabaseUrl) ||
      (hasInjectedDirectUrl && !injectedDirectUrl)
    ) {
      throw new Error("Prisma database URL override cannot be blank");
    }

    const url = injectedDatabaseUrl ?? injectedDirectUrl;
    const directUrl = injectedDirectUrl ?? injectedDatabaseUrl;

    if (!(url && directUrl)) {
      throw new Error("Prisma database URL override is invalid");
    }

    return { directUrl, url };
  }

  const url = nonEmpty(loaded.databaseUrl);
  if (!url) {
    throw new Error("DATABASE_URL is required by Prisma");
  }

  return {
    directUrl: nonEmpty(loaded.directUrl) ?? url,
    url,
  };
};
