import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  const protectedPaths = [
    "/dashboard",
    "/pick",
    "/fixtures",
    "/standings",
    "/history",
    "/admin",
  ];
  const isProtected = protectedPaths.some((p) =>
    nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !isAuthenticated) {
    return Response.redirect(new URL("/login", nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|error).*)",
  ],
};
