BEGIN;

DO $$
BEGIN
    CREATE TYPE "CashierShiftStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "cashier_shifts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "CashierShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DECIMAL(10,2) NOT NULL,
    "closingCash" DECIMAL(10,2),
    "dailySales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "soldProducts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    ALTER TABLE "cashier_shifts"
        ADD CONSTRAINT "cashier_shifts_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "cashier_shifts"
        ADD CONSTRAINT "cashier_shifts_cashierId_fkey"
        FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "cashier_shifts_tenantId_cashierId_status_idx"
    ON "cashier_shifts" ("tenantId", "cashierId", "status");

CREATE INDEX IF NOT EXISTS "cashier_shifts_tenantId_openedAt_idx"
    ON "cashier_shifts" ("tenantId", "openedAt");

-- Enforce one active shift per cashier, including across concurrent instances.
-- This intentionally fails deployment when historical duplicate OPEN shifts exist
-- so they can be reviewed instead of being closed or discarded automatically.
CREATE UNIQUE INDEX IF NOT EXISTS "cashier_shifts_one_open_per_cashier_key"
    ON "cashier_shifts" ("tenantId", "cashierId")
    WHERE "status" = 'OPEN';

COMMIT;
