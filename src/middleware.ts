import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

/**
 * Redirects signed-out visitors away from app pages, and blocks /admin for non-admins with
 * a flat 404 before any rendering happens. API routes are excluded here and authenticate
 * themselves (returning 401/403 JSON instead of a redirect).
 *
 * The admin check lives here, not only in the admin layout: the (app) root has a loading.tsx
 * Suspense boundary, and Next.js starts streaming a 200 response (and renders pages in
 * parallel with their layouts) before a layout's own `notFound()` can take effect. Checking
 * the role here, from the JWT, happens before any of that rendering starts.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAdminPath && req.auth?.user?.role !== "ADMIN") {
    // The admin area's existence is not advertised to non-admins — a plain 404, no UI.
    return new NextResponse("Not Found", { status: 404 });
  }

  const authorized = authConfig.callbacks.authorized({ auth: req.auth, request: req });
  if (!authorized) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
