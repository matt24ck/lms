-- AlterEnum
ALTER TYPE "PickOutcome" ADD VALUE 'SAVED';

-- AlterTable
ALTER TABLE "league_members" ADD COLUMN     "lifelines" INTEGER NOT NULL DEFAULT 0;

