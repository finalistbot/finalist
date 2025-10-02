/*
  Warnings:

  - The values [CONFIGURATION,SLOT_ALLOCATION,ONGOING,CANCELED] on the enum `Stage` will be removed. If these variants are still used in the database, this will fail.
  - The `open_days` column on the `scrim` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;

-- Create the new enum first
CREATE TYPE "public"."Stage_new" AS ENUM ('IDLE', 'REGISTRATION', 'CLOSED', 'COMPLETED');

-- Drop default to safely alter
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" DROP DEFAULT;

-- Safely cast old values to new enum (map all old values to 'IDLE')
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" TYPE "public"."Stage_new"
USING (
  CASE "stage"
    WHEN 'CONFIGURATION' THEN 'IDLE'::text::"public"."Stage_new"
    WHEN 'SLOT_ALLOCATION' THEN 'IDLE'::text::"public"."Stage_new"
    WHEN 'ONGOING' THEN 'IDLE'::text::"public"."Stage_new"
    WHEN 'CANCELED' THEN 'IDLE'::text::"public"."Stage_new"
    ELSE "stage"::text::"public"."Stage_new"
  END
);

-- Replace old enum
ALTER TYPE "public"."Stage" RENAME TO "Stage_old";
ALTER TYPE "public"."Stage_new" RENAME TO "Stage";
DROP TYPE "public"."Stage_old";

-- Set default
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" SET DEFAULT 'IDLE';

COMMIT;

-- AlterTable
ALTER TABLE "public"."scrim"
  ALTER COLUMN "stage" SET DEFAULT 'IDLE',
  DROP COLUMN IF EXISTS "open_days",
  ADD COLUMN "open_days" INTEGER[];

-- DropEnum
DROP TYPE IF EXISTS "public"."OpenDays";
