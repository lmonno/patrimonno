import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPaths = ["/dashboard", "/intestatari", "/conti", "/saldi", "/tipi-conto"];
      const isProtected = protectedPaths.some((path) => nextUrl.pathname.startsWith(path));

      if (isProtected) {
        return isLoggedIn;
      }

      if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.ruolo = u.ruolo;
        token.nome = u.nome;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.ruolo = token.ruolo as "ADMIN" | "UTENTE";
        session.user.nome = token.nome as string;
      }
      return session;
    },
  },
  providers: [],
};
