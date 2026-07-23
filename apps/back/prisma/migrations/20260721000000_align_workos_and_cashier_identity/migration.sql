BEGIN;

-- Make the migration history reproduce the WorkOS administrator and
-- PIN-only cashier identity model declared in schema.prisma.
ALTER TABLE "tenants"
    ADD COLUMN IF NOT EXISTS "workosOrgId" TEXT;

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "pinHash" TEXT,
    ADD COLUMN IF NOT EXISTS "workosUserId" TEXT,
    ALTER COLUMN "email" DROP NOT NULL;

-- Preserve legacy cashier credentials before removing the obsolete column.
-- CashierService can verify both bcrypt and the legacy PBKDF2 representation,
-- and upgrades a valid legacy hash to bcrypt on the next successful login.
DO $$
DECLARE
    legacy_password_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
          AND column_name = 'passwordHash'
    ) INTO legacy_password_exists;

    IF legacy_password_exists THEN
        UPDATE "users"
        SET "pinHash" = "passwordHash"
        WHERE "role" = 'CASHIER'
          AND "pinHash" IS NULL
          AND "passwordHash" IS NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "users"
        WHERE "role" = 'CASHIER'
          AND "isActive" = true
          AND "cashierCode" IS NOT NULL
          AND "pinHash" IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot align cashier identity: an active cashier has no PIN hash';
    END IF;

    IF legacy_password_exists THEN
        ALTER TABLE "users" DROP COLUMN "passwordHash";
    END IF;
END $$;

-- Canonicalize cashier codes so login can use indexed equality instead of
-- case-insensitive pattern matching (where %, _ and \ are metacharacters).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT "tenantId", UPPER("cashierCode") AS normalized_code
            FROM "users"
            WHERE "cashierCode" IS NOT NULL
            GROUP BY "tenantId", UPPER("cashierCode")
            HAVING COUNT(*) > 1
        ) AS duplicate_codes
    ) THEN
        RAISE EXCEPTION
            'Cannot normalize cashier codes: case-insensitive duplicates exist';
    END IF;

    UPDATE "users"
    SET "cashierCode" = UPPER("cashierCode")
    WHERE "cashierCode" IS NOT NULL;

    IF EXISTS (
        SELECT 1
        FROM "users"
        WHERE "cashierCode" IS NOT NULL
          AND (
              CHAR_LENGTH("cashierCode") < 3
              OR CHAR_LENGTH("cashierCode") > 20
              OR "cashierCode" !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
          )
    ) THEN
        RAISE EXCEPTION
            'Cannot normalize cashier codes: non-canonical values require manual review';
    END IF;
END $$;

DO $$
BEGIN
    ALTER TABLE "users"
        ADD CONSTRAINT "users_cashierCode_format_check"
        CHECK (
            "cashierCode" IS NULL
            OR (
                CHAR_LENGTH("cashierCode") BETWEEN 3 AND 20
                AND "cashierCode" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
            )
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_workosOrgId_key"
    ON "tenants"("workosOrgId");

CREATE INDEX IF NOT EXISTS "tenants_workosOrgId_idx"
    ON "tenants"("workosOrgId");

CREATE UNIQUE INDEX IF NOT EXISTS "users_workosUserId_key"
    ON "users"("workosUserId");

CREATE INDEX IF NOT EXISTS "users_workosUserId_idx"
    ON "users"("workosUserId");

COMMIT;
