-- AlterTable
ALTER TABLE "public"."scrim" ADD COLUMN     "roomDetailId" INTEGER;

-- CreateTable
CREATE TABLE "public"."RoomDetail" (
    "id" SERIAL NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomDetail_scrim_id_key" ON "public"."RoomDetail"("scrim_id");

-- AddForeignKey
ALTER TABLE "public"."RoomDetail" ADD CONSTRAINT "RoomDetail_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
