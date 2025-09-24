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
CREATE UNIQUE INDEX "scrim_preset_guild_id_name_key" ON "public"."scrim_preset"("guild_id", "name");
