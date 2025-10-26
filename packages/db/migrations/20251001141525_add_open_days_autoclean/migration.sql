-- CreateEnum
CREATE TYPE "public"."AutoCleanType" AS ENUM ('CHANNELS', 'ROLES');

-- CreateEnum
CREATE TYPE "public"."OpenDays" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- AlterTable
ALTER TABLE "public"."scrim" ADD COLUMN     "auto_clean_types" "public"."AutoCleanType"[],
ADD COLUMN     "open_days" "public"."OpenDays"[],
ALTER COLUMN "registration_ended_time" SET DATA TYPE TIMESTAMPTZ(6);

-- Update Data with all days open and both auto clean types
UPDATE "public"."scrim" SET "open_days" = ARRAY['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']::"public"."OpenDays"[],
"auto_clean_types" = ARRAY['CHANNELS', 'ROLES']::"public"."AutoCleanType"[];
