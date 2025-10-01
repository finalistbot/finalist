/*
  Warnings:

  - You are about to drop the column `userId` on the `team` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."team" DROP CONSTRAINT "team_userId_fkey";

-- AlterTable
ALTER TABLE "public"."team" DROP COLUMN "userId";
