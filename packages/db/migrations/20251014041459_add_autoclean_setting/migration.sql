/*
  Warnings:

  - You are about to drop the column `auto_clean_types` on the `scrim` table. All the data in the column will be lost.

*/
-- AlterTable
BEGIN;

ALTER TABLE "public"."scrim"
RENAME COLUMN "auto_clean_types" TO "autoclean_types";

ALTER TABLE "public"."scrim"
ADD COLUMN "autoclean_time" TIMESTAMPTZ(6);

COMMIT;
