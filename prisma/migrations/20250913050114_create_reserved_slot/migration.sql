-- CreateTable
CREATE TABLE "public"."reserved_slot" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "scrim_id" INTEGER NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserved_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reserved_slot_scrim_id_slot_number_key" ON "public"."reserved_slot"("scrim_id", "slot_number");

-- AddForeignKey
ALTER TABLE "public"."reserved_slot" ADD CONSTRAINT "reserved_slot_scrim_id_fkey" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
