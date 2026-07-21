import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      profile(p) {
        return {
          id: String(p.id),
          name: p.name ?? p.login,
          email: p.email,
          image: p.avatar_url,
          githubUsername: p.login,
        };
      },
    }),
    // ponytail: dev-only demo login so the app is demoable without OAuth secrets
    Credentials({
      id: "demo",
      name: "Demo user",
      credentials: { email: { label: "Email" } },
      async authorize(creds) {
        if (process.env.NODE_ENV === "production") return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, String(creds?.email ?? "")),
        });
        return user ?? null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      return session;
    },
  },
});

/** Current user id or redirect-worthy null. */
export async function currentUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}
