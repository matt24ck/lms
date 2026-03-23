import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Premier League 2025/26 teams (IDs from football-data.org)
const PL_TEAMS = [
  { apiTeamId: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS", crestUrl: "https://crests.football-data.org/57.png" },
  { apiTeamId: 58, name: "Aston Villa FC", shortName: "Aston Villa", tla: "AVL", crestUrl: "https://crests.football-data.org/58.png" },
  { apiTeamId: 402, name: "AFC Bournemouth", shortName: "Bournemouth", tla: "BOU", crestUrl: "https://crests.football-data.org/1044.png" },
  { apiTeamId: 328, name: "Burnley FC", shortName: "Burnley", tla: "BUR", crestUrl: "https://crests.football-data.org/328.png" },
  { apiTeamId: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE", crestUrl: "https://crests.football-data.org/61.png" },
  { apiTeamId: 354, name: "Crystal Palace FC", shortName: "Crystal Palace", tla: "CRY", crestUrl: "https://crests.football-data.org/354.png" },
  { apiTeamId: 62, name: "Everton FC", shortName: "Everton", tla: "EVE", crestUrl: "https://crests.football-data.org/62.png" },
  { apiTeamId: 63, name: "Fulham FC", shortName: "Fulham", tla: "FUL", crestUrl: "https://crests.football-data.org/63.png" },
  { apiTeamId: 64, name: "Liverpool FC", shortName: "Liverpool", tla: "LIV", crestUrl: "https://crests.football-data.org/64.png" },
  { apiTeamId: 65, name: "Manchester City FC", shortName: "Man City", tla: "MCI", crestUrl: "https://crests.football-data.org/65.png" },
  { apiTeamId: 66, name: "Manchester United FC", shortName: "Man United", tla: "MUN", crestUrl: "https://crests.football-data.org/66.png" },
  { apiTeamId: 67, name: "Newcastle United FC", shortName: "Newcastle", tla: "NEW", crestUrl: "https://crests.football-data.org/67.png" },
  { apiTeamId: 68, name: "Norwich City FC", shortName: "Norwich", tla: "NOR", crestUrl: "https://crests.football-data.org/68.png" },
  { apiTeamId: 73, name: "Tottenham Hotspur FC", shortName: "Tottenham", tla: "TOT", crestUrl: "https://crests.football-data.org/73.png" },
  { apiTeamId: 76, name: "Wolverhampton Wanderers FC", shortName: "Wolves", tla: "WOL", crestUrl: "https://crests.football-data.org/76.png" },
  { apiTeamId: 563, name: "West Ham United FC", shortName: "West Ham", tla: "WHU", crestUrl: "https://crests.football-data.org/563.png" },
  { apiTeamId: 351, name: "Nottingham Forest FC", shortName: "Nott'm Forest", tla: "NFO", crestUrl: "https://crests.football-data.org/351.png" },
  { apiTeamId: 389, name: "Luton Town FC", shortName: "Luton", tla: "LUT", crestUrl: "https://crests.football-data.org/389.png" },
  { apiTeamId: 397, name: "Brighton & Hove Albion FC", shortName: "Brighton", tla: "BHA", crestUrl: "https://crests.football-data.org/397.png" },
  { apiTeamId: 341, name: "Leeds United FC", shortName: "Leeds", tla: "LEE", crestUrl: "https://crests.football-data.org/341.png" },
];

async function main() {
  console.log("Seeding Premier League teams...");

  for (const team of PL_TEAMS) {
    await prisma.team.upsert({
      where: { apiTeamId: team.apiTeamId },
      update: {
        name: team.name,
        shortName: team.shortName,
        tla: team.tla,
        crestUrl: team.crestUrl,
      },
      create: team,
    });
  }

  console.log(`Seeded ${PL_TEAMS.length} teams.`);
  console.log(
    "\nNote: Run the seed again after connecting the football-data.org API"
  );
  console.log(
    "to get the exact current season teams. These are approximate defaults."
  );
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
