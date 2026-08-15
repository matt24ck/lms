import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Database sessions (rather than JWT) keep `isAdmin` authoritative — flipping
 * the flag in the database takes effect on the next request instead of when a
 * stale token happens to expire.
 *
 * Because the Prisma adapter cannot run on the edge, route protection lives in
 * the server layouts (`src/app/(app)/layout.tsx` and the admin layout) rather
 * than in middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Discord({
      // `identify` gives us the username and avatar; `email` lets returning
      // players keep one account if they change Discord username.
      authorization:
        "https://discord.com/api/oauth2/authorize?scope=identify+email",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * Discord reports emails a user has typed but never confirmed
     * (`verified: false`). Without this check someone could set another
     * person's address on their Discord account and sign in with it —
     * claiming that user's identity here, blocking the real owner's later
     * sign-up via the unique-email constraint, and, if the address is in
     * ADMIN_EMAILS, being promoted to admin. Only verified emails get in.
     */
    signIn({ account, profile }) {
      if (account?.provider !== "discord") return true;
      return (profile as { verified?: boolean } | undefined)?.verified === true;
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isAdmin =
          (user as typeof user & { isAdmin?: boolean }).isAdmin ?? false;
      }
      return session;
    },
  },
  events: {
    /**
     * Bootstraps admins from ADMIN_EMAILS (comma-separated) so the first admin
     * doesn't need a manual SQL update. This only ever grants the flag —
     * removing an address here will not demote anyone, so revoking admin is a
     * deliberate database change. The signIn callback above guarantees the
     * email was verified by Discord before it can match this list.
     */
    async signIn({ user }) {
      const allowList = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      if (allowList.length === 0 || !user.id || !user.email) return;
      if (!allowList.includes(user.email.toLowerCase())) return;

      await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      });
    },
  },
});

/** Session guard for server components. Returns null when signed out. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
