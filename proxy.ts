import { NextRequest, NextResponse } from "next/server";
import { checkLocalTrustFromRequest } from "@/shared/security/local-session";

/**
 * One trust boundary for every local API route.
 *
 * Route handlers may keep a second guard for high-privilege operations, but
 * correctness no longer depends on every new write route remembering one.
 */
export function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const trust = checkLocalTrustFromRequest(req);
  if (!trust.ok) {
    return NextResponse.json({ error: trust.error }, { status: trust.status });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
