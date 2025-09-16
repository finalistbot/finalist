/*
  Warnings:

  - The values [CHECKIN] on the enum `Stage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Stage_new" AS ENUM ('CONFIGURATION', 'REGISTRATION', 'SLOT_ALLOCATION', 'ONGOING', 'COMPLETED', 'CANCELED');
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" TYPE "public"."Stage_new" USING ("stage"::text::"public"."Stage_new");
ALTER TYPE "public"."Stage" RENAME TO "Stage_old";
ALTER TYPE "public"."Stage_new" RENAME TO "Stage";
DROP TYPE "public"."Stage_old";
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" SET DEFAULT 'CONFIGURATION';
COMMIT;
