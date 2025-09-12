-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "public"."Stage" AS ENUM ('CONFIGURATION', 'REGISTRATION', 'CHECKIN', 'ONGOING', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."guild_config" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "adminRoleId" TEXT,
    "updatesChannelId" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scrim" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registration_start_time" TIMESTAMP(3) NOT NULL,
    "registration_ended_time" TIMESTAMP(3),
    "max_teams" INTEGER NOT NULL,
    "min_players_per_team" INTEGER NOT NULL,
    "max_players_per_team" INTEGER NOT NULL,
    "max_substitute_per_team" INTEGER NOT NULL,
    "slot_list_message_id" TEXT,
    "auto_slot_list" BOOLEAN NOT NULL DEFAULT true,
    "registration_channel_id" TEXT NOT NULL,
    "logs_channel_id" TEXT NOT NULL,
    "participants_channel_id" TEXT NOT NULL,
    "discord_category_id" TEXT NOT NULL,
    "admin_channel_id" TEXT NOT NULL,
    "admin_config_message_id" TEXT,
    "stage" "public"."Stage" NOT NULL DEFAULT 'CONFIGURATION',
    "auto_close_registration" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "roomDetailId" INTEGER,

    CONSTRAINT "scrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team" (
    "id" SERIAL NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "message_id" TEXT,
    "registered_at" TIMESTAMP(3),
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_member" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_substitute" BOOLEAN NOT NULL DEFAULT false,
    "is_captain" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."banned_user" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assigned_slot" (
    "id" SERIAL NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assigned_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."room_detail" (
    "id" SERIAL NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_detail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_config_guildId_key" ON "public"."guild_config"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "team_code_key" ON "public"."team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_team_id_user_id_key" ON "public"."team_member"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_scrim_id_user_id_key" ON "public"."team_member"("scrim_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "banned_user_guild_id_user_id_key" ON "public"."banned_user"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assigned_slot_scrim_id_team_id_key" ON "public"."assigned_slot"("scrim_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "assigned_slot_scrim_id_slot_number_key" ON "public"."assigned_slot"("scrim_id", "slot_number");

-- CreateIndex
CREATE UNIQUE INDEX "room_detail_scrim_id_key" ON "public"."room_detail"("scrim_id");

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assigned_slot" ADD CONSTRAINT "assigned_slot_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assigned_slot" ADD CONSTRAINT "assigned_slot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."room_detail" ADD CONSTRAINT "room_detail_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
