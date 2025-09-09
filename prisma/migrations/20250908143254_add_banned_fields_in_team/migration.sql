-- AlterTable
ALTER TABLE "public"."team" ADD COLUMN     "ban_reason" TEXT,
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false;
