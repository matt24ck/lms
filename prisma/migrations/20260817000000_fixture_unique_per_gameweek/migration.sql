-- Fixture.externalId (the football-data.org match id) was globally unique,
-- but fixtures are per-gameweek snapshots: the same real match is copied into
-- every gameweek that uses its matchday (a second league launching the same
-- matchday, or a relaunch after a voided week). Launching then failed with a
-- unique-constraint violation. Uniqueness only ever mattered within a single
-- gameweek, so scope the constraint accordingly.

-- DropIndex
DROP INDEX "fixtures_externalId_key";

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_gameweekId_externalId_key" ON "fixtures"("gameweekId", "externalId");
