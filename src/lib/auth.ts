import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as {
          id: string;
          username: string;
          avatar?: string;
        };

        token.discordId = discordProfile.id;
        token.discordUsername = discordProfile.username;

        const user = await prisma.user.findUnique({
          where: { discordId: discordProfile.id },
          select: { isAdmin: true, id: true },
        });
        token.isAdmin = user?.isAdmin ?? false;
        token.userId = user?.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.discordId = token.discordId as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
    async signIn({ account, profile }) {
      if (account?.provider === "discord" && account.access_token) {
        // Check if user is in the required Discord server
        const guildId = process.env.DISCORD_GUILD_ID;
        if (guildId) {
          const guildsRes = await fetch(
            "https://discord.com/api/v10/users/@me/guilds",
            {
              headers: {
                Authorization: `Bearer ${account.access_token}`,
              },
            }
          );

          if (guildsRes.ok) {
            const guilds = (await guildsRes.json()) as { id: string }[];
            const inServer = guilds.some((g) => g.id === guildId);
            if (!inServer) {
              return false; // Blocks sign-in
            }
          }
        }

        const discordProfile = profile as {
          id: string;
          username: string;
          avatar?: string;
          email?: string;
        };

        await prisma.user.upsert({
          where: { discordId: discordProfile.id },
          update: {
            discordUsername: discordProfile.username,
            discordAvatar: discordProfile.avatar ?? null,
            image: discordProfile.avatar
              ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
              : null,
          },
          create: {
            discordId: discordProfile.id,
            discordUsername: discordProfile.username,
            discordAvatar: discordProfile.avatar ?? null,
            email: discordProfile.email ?? null,
            name: discordProfile.username,
            image: discordProfile.avatar
              ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
              : null,
          },
        });
      }
      return true;
    },
  },
});
