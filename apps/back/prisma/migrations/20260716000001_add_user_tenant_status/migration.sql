-- CreateEnum
CREATE TYPE "UserTenantStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- Backfill existing rows to ACTIVE
UPDATE "user_tenants" SET "status" = 'ACTIVE';

-- AlterTable
ALTER TABLE "user_tenants" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedByUserId" TEXT,
ADD COLUMN     "status" "UserTenantStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
