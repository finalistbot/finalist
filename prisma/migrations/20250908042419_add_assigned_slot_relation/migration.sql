-- AddForeignKey
ALTER TABLE "public"."assigned_slot" ADD CONSTRAINT "assigned_slot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
