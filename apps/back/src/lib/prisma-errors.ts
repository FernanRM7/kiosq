interface PrismaKnownRequestErrorLike {
  code?: string;
  message?: string;
  meta?: {
    table?: string;
  };
}

export function isMissingPrismaTableError(
  error: unknown,
  tableName: string
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as PrismaKnownRequestErrorLike).code !== "P2021"
  ) {
    return false;
  }

  const knownError = error as PrismaKnownRequestErrorLike;
  const metaTable = knownError.meta?.table;

  if (typeof metaTable === "string") {
    return metaTable === tableName;
  }

  return typeof knownError.message === "string"
    ? knownError.message.includes(tableName)
    : false;
}
