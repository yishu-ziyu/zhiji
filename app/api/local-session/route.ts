import { NextResponse } from "next/server";
import {
  ensureLocalSession,
  sessionCookieHeader,
} from "@/shared/security/local-session";

/** Establish HttpOnly session + CSRF cookie for local Owner UI. */
export async function GET() {
  const session = ensureLocalSession();
  const res = NextResponse.json({
    ok: true,
    csrfToken: session.csrfToken,
  });
  for (const c of sessionCookieHeader(session)) {
    res.headers.append("Set-Cookie", c);
  }
  return res;
}
