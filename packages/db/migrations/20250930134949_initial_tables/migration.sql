-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "public"."Stage" AS ENUM ('CONFIGURATION', 'REGISTRATION', 'SLOT_ALLOCATION', 'ONGOING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."TeamRole" AS ENUM ('CAPTAIN', 'MEMBER', 'SUBSTITUTE');

-- CreateTable
CREATE TABLE "public"."guild_config" (
    "id" TEXT NOT NULL,
    "admin_role_id" TEXT,
    "teams_per_captain" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_config_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "public"."scrim" (
    "id" SERIAL NOT NULL,
    "guild_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registration_start_time" TIMESTAMPTZ(6) NOT NULL,
    "registration_ended_time" TIMESTAMP(3),
    "max_teams" INTEGER NOT NULL,
    "min_players_per_team" INTEGER NOT NULL,
    "max_players_per_team" INTEGER NOT NULL,
    "max_substitute_per_team" INTEGER NOT NULL,
    "auto_slot_list" BOOLEAN NOT NULL DEFAULT true,
    "registration_channel_id" TEXT NOT NULL,
    "logs_channel_id" TEXT NOT NULL,
    "participants_channel_id" TEXT NOT NULL,
    "participant_role_id" TEXT,
    "discord_category_id" TEXT NOT NULL,
    "admin_channel_id" TEXT NOT NULL,
    "admin_config_message_id" TEXT,
    "stage" "public"."Stage" NOT NULL DEFAULT 'CONFIGURATION',
    "auto_close_registration" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "guild_id" TEXT NOT NULL,
    "tag" TEXT,
    "userId" TEXT,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_member" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "public"."TeamRole" NOT NULL DEFAULT 'MEMBER',
    "ingame_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
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
    "slot_number" INTEGER NOT NULL,
    "message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "registered_team_id" INTEGER NOT NULL,

    CONSTRAINT "assigned_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reserved_slot" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserved_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."room_detail" (
    "id" SERIAL NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scrim_preset" (
    "id" SERIAL NOT NULL,
    "settings" JSONB NOT NULL,
    "guild_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrim_preset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_code_key" ON "public"."team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_team_id_user_id_key" ON "public"."team_member"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_team_id_position_key" ON "public"."team_member"("team_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "registered_team_scrim_id_team_id_key" ON "public"."registered_team"("scrim_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "registered_team_member_registered_team_id_position_key" ON "public"."registered_team_member"("registered_team_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "registered_team_member_registered_team_id_userId_key" ON "public"."registered_team_member"("registered_team_id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "banned_user_guild_id_user_id_key" ON "public"."banned_user"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "assigned_slot_registered_team_id_key" ON "public"."assigned_slot"("registered_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "assigned_slot_scrim_id_slot_number_key" ON "public"."assigned_slot"("scrim_id", "slot_number");

-- CreateIndex
CREATE UNIQUE INDEX "reserved_slot_scrim_id_slot_number_key" ON "public"."reserved_slot"("scrim_id", "slot_number");

-- CreateIndex
CREATE UNIQUE INDEX "room_detail_scrim_id_key" ON "public"."room_detail"("scrim_id");

-- CreateIndex
CREATE UNIQUE INDEX "scrim_preset_guild_id_name_key" ON "public"."scrim_preset"("guild_id", "name");

-- AddForeignKey
ALTER TABLE "public"."team" ADD CONSTRAINT "team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."assigned_slot" ADD CONSTRAINT "assigned_slot_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reserved_slot" ADD CONSTRAINT "reserved_slot_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reserved_slot" ADD CONSTRAINT "reserved_slot_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."room_detail" ADD CONSTRAINT "room_detail_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
