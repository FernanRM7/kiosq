-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cashierCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_cashierCode_key" ON "users"("tenantId", "cashierCode");
