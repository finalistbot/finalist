/*
  Warnings:
  - The values [CONFIGURATION,SLOT_ALLOCATION,ONGOING,CANCELED] on the enum `Stage` will be removed. If these variants are still used in the database, this will fail.
  - The `open_days` column on the `scrim` table would be dropped and recreated. This will lead to data loss if there is data in the column.
*/

-- Step 1: Create new enum type with desired values
CREATE TYPE "public"."Stage_new" AS ENUM ('IDLE', 'REGISTRATION', 'CLOSED', 'COMPLETED');

-- Step 2: Drop default temporarily to allow type change
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" DROP DEFAULT;

-- Step 3: Change column type to new enum, mapping old values to new ones
ALTER TABLE "public"."scrim" 
  ALTER COLUMN "stage" TYPE "public"."Stage_new" 
  USING (
    CASE "stage"::text
      WHEN 'CONFIGURATION' THEN 'IDLE'
      WHEN 'SLOT_ALLOCATION' THEN 'IDLE'
      WHEN 'ONGOING' THEN 'IDLE'
      WHEN 'CANCELED' THEN 'IDLE'
      ELSE "stage"::text
    END
  )::"public"."Stage_new";

-- Step 4: Drop old enum type
DROP TYPE "public"."Stage";

-- Step 5: Rename new enum to original name
ALTER TYPE "public"."Stage_new" RENAME TO "Stage";

-- Step 6: Restore default value
ALTER TABLE "public"."scrim" ALTER COLUMN "stage" SET DEFAULT 'IDLE'::"public"."Stage";

-- Step 7: AlterTable - Change open_days from enum to integer array
ALTER TABLE "public"."scrim"
  DROP COLUMN IF EXISTS "open_days",
  ADD COLUMN "open_days" INTEGER[];

-- Step 8: DropEnum - Remove OpenDays enum if it exists
DROP TYPE IF EXISTS "public"."OpenDays";
