import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Absolute URL on the public origin. Behind nginx, req.url points at the internal
 * bind address (127.0.0.1/localhost), so redirects must use APP_URL or the forwarded host.
 */
function publicUrl(req: NextRequest, path: string) {
  const configured = process.env.APP_URL;
  if (configured) return new URL(path, configured);
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host")) ?? req.nextUrl.host;
  const proto = first(req.headers.get("x-forwarded-proto")) ?? req.nextUrl.protocol.replace(/:$/, "");
  return new URL(path, `${proto}://${host}`);
}

// Fast edge check; pages still re-validate the user against the database.
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;
  if (!session && pathname !== "/login") {
    const url = publicUrl(req, "/login");
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (session && pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(publicUrl(req, "/overview"));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/health).*)"],
};
