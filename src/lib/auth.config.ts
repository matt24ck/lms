import Discord from "next-auth/providers/discord";
import type { NextAuthConfig } from "next-auth";

// Edge-compatible config (no Prisma import)
export default {
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/error",
  },
} satisfies NextAuthConfig;
