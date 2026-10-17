import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Redirects signed-out visitors away from app pages. API routes are excluded here and
 * authenticate themselves (returning 401 JSON instead of a redirect).
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
