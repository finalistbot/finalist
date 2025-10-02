/*
  Warnings:

  - The values [CONFIGURATION,SLOT_ALLOCATION,ONGOING,CANCELED] on the enum `Stage` will be removed. If these variants are still used in the database, this will fail.
  - The `open_days` column on the `scrim` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Stage_new" AS ENUM ('IDLE', 'REGISTRATION', 'CLOSED', 'COMPLETED');
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" TYPE "public"."Stage_new" USING ("stage"::text::"public"."Stage_new");
ALTER TYPE "public"."Stage" RENAME TO "Stage_old";
ALTER TYPE "public"."Stage_new" RENAME TO "Stage";
DROP TYPE "public"."Stage_old";
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" SET DEFAULT 'IDLE';
COMMIT;

-- AlterTable
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" SET DEFAULT 'IDLE',
DROP COLUMN "open_days",
ADD COLUMN     "open_days" INTEGER[];

-- DropEnum
DROP TYPE "public"."OpenDays";
