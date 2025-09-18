/*
  Warnings:

  - Added the required column `participants_role_id` to the `scrim` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."scrim" ADD COLUMN     "participants_role_id" TEXT NOT NULL;
