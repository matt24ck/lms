const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID!;
const DISCORD_API = "https://discord.com/api/v10";

export async function isUserInGuild(discordId: string): Promise<boolean> {
  const res = await fetch(
    `${DISCORD_API}/guilds/${DISCORD_GUILD_ID}/members/${discordId}`,
    {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
      cache: "no-store",
    }
  );

  if (res.ok) return true;
  if (res.status === 404) return false;
  throw new Error(`Discord API error: ${res.status}`);
}

export async function getAllGuildMembers(): Promise<string[]> {
  const memberIds: string[] = [];
  let after = "0";

  while (true) {
    const res = await fetch(
      `${DISCORD_API}/guilds/${DISCORD_GUILD_ID}/members?limit=1000&after=${after}`,
      {
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status}`);
    }

    const members = (await res.json()) as { user: { id: string } }[];
    if (members.length === 0) break;

    memberIds.push(...members.map((m) => m.user.id));
    after = members[members.length - 1].user.id;

    if (members.length < 1000) break;
  }

  return memberIds;
}
