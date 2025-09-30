/*
  Warnings:

  - You are about to drop the column `team_id` on the `assigned_slot` table. All the data in the column will be lost.
  - The primary key for the `guild_config` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `adminRoleId` on the `guild_config` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `guild_config` table. All the data in the column will be lost.
  - You are about to drop the column `guildId` on the `guild_config` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `guild_config` table. All the data in the column will be lost.
  - You are about to drop the column `captain_add_members` on the `scrim` table. All the data in the column will be lost.
  - You are about to drop the column `roomDetailId` on the `scrim` table. All the data in the column will be lost.
  - You are about to drop the column `slot_list_message_id` on the `scrim` table. All the data in the column will be lost.
  - You are about to drop the column `message_id` on the `team` table. All the data in the column will be lost.
  - You are about to drop the column `registered_at` on the `team` table. All the data in the column will be lost.
  - You are about to drop the column `scrim_id` on the `team` table. All the data in the column will be lost.
  - You are about to drop the column `display_name` on the `team_member` table. All the data in the column will be lost.
  - You are about to drop the column `is_captain` on the `team_member` table. All the data in the column will be lost.
  - You are about to drop the column `is_substitute` on the `team_member` table. All the data in the column will be lost.
  - You are about to drop the column `scrim_id` on the `team_member` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[registered_team_id]` on the table `assigned_slot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[team_id,position]` on the table `team_member` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `registered_team_id` to the `assigned_slot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `guild_config` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guild_id` to the `team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
DELETE FROM "team";
DELETE FROM "scrim";

CREATE TYPE "public"."TeamRole" AS ENUM ('CAPTAIN', 'MEMBER', 'SUBSTITUTE');

-- DropForeignKey
ALTER TABLE "public"."assigned_slot" DROP CONSTRAINT "assigned_slot_team_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."team" DROP CONSTRAINT "team_scrim_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."team_member" DROP CONSTRAINT "team_member_scrim_id_fkey";

-- DropIndex
DROP INDEX "public"."assigned_slot_scrim_id_team_id_key";

-- DropIndex
DROP INDEX "public"."guild_config_guildId_key";

-- DropIndex
DROP INDEX "public"."team_member_scrim_id_user_id_key";

-- AlterTable
ALTER TABLE "public"."assigned_slot" DROP COLUMN "team_id",
ADD COLUMN     "registered_team_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."guild_config" DROP CONSTRAINT "guild_config_pkey",
DROP COLUMN "adminRoleId",
DROP COLUMN "createdAt",
DROP COLUMN "guildId",
DROP COLUMN "updatedAt",
ADD COLUMN     "admin_role_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "teams_per_captain" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "guild_config_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "guild_config_id_seq";

-- AlterTable
ALTER TABLE "public"."scrim" DROP COLUMN "captain_add_members",
DROP COLUMN "roomDetailId",
DROP COLUMN "slot_list_message_id";

-- AlterTable
ALTER TABLE "public"."team" DROP COLUMN "message_id",
DROP COLUMN "registered_at",
DROP COLUMN "scrim_id",
ADD COLUMN     "guild_id" TEXT NOT NULL,
ADD COLUMN     "tag" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "public"."team_member" DROP COLUMN "display_name",
DROP COLUMN "is_captain",
DROP COLUMN "is_substitute",
DROP COLUMN "scrim_id",
ADD COLUMN     "ingame_name" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "role" "public"."TeamRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registered_team" (
    "id" SERIAL NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registered_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registered_team_member" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingame_name" TEXT,
    "userId" TEXT NOT NULL,
    "registered_team_id" INTEGER NOT NULL,
    "role" "public"."TeamRole" NOT NULL DEFAULT 'MEMBER',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "registered_team_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registered_team_scrim_id_team_id_key" ON "public"."registered_team"("scrim_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "registered_team_member_registered_team_id_position_key" ON "public"."registered_team_member"("registered_team_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "registered_team_member_registered_team_id_userId_key" ON "public"."registered_team_member"("registered_team_id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "assigned_slot_registered_team_id_key" ON "public"."assigned_slot"("registered_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_team_id_position_key" ON "public"."team_member"("team_id", "position");

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registered_team" ADD CONSTRAINT "registered_team_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registered_team" ADD CONSTRAINT "registered_team_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registered_team_member" ADD CONSTRAINT "registered_team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registered_team_member" ADD CONSTRAINT "registered_team_member_registered_team_id_fkey" FOREIGN KEY ("registered_team_id") REFERENCES "public"."registered_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."banned_user" ADD CONSTRAINT "banned_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assigned_slot" ADD CONSTRAINT "assigned_slot_registered_team_id_fkey" FOREIGN KEY ("registered_team_id") REFERENCES "public"."registered_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reserved_slot" ADD CONSTRAINT "reserved_slot_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
