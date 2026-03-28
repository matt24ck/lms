import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BASE_URL = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

async function main() {
  if (!API_KEY) {
    console.error(
      "FOOTBALL_DATA_API_KEY is not set. Add it to your .env file."
    );
    process.exit(1);
  }

  console.log("Fetching current Premier League teams from football-data.org...");

  const res = await fetch(`${BASE_URL}/competitions/PL/teams`, {
    headers: { "X-Auth-Token": API_KEY },
  });

  if (!res.ok) {
    console.error(`API error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data = await res.json();
  const teams: { id: number; name: string; shortName: string; tla: string; crest: string }[] = data.teams;

  console.log(`Found ${teams.length} teams. Seeding...`);

  for (const team of teams) {
    await prisma.team.upsert({
      where: { apiTeamId: team.id },
      update: {
        name: team.name,
        shortName: team.shortName,
        tla: team.tla,
        crestUrl: team.crest,
      },
      create: {
        apiTeamId: team.id,
        name: team.name,
        shortName: team.shortName,
        tla: team.tla,
        crestUrl: team.crest,
      },
    });
  }

  // Remove teams no longer in the PL (e.g. relegated teams from old seeds)
  const currentApiIds = teams.map((t) => t.id);
  const deleted = await prisma.team.deleteMany({
    where: { apiTeamId: { notIn: currentApiIds } },
  });

  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} teams no longer in the Premier League.`);
  }

  console.log(`Seeded ${teams.length} teams.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
