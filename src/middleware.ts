import { NextResponse, type NextRequest } from "next/server";
import {
  LOGIN_PATH,
  LOGOUT_PATH,
  REGISTER_PATH,
} from "@/lib/auth/paths";

const POST_AUTH_REWRITES: Record<string, string> = {
  [REGISTER_PATH]: "/api/register",
  [LOGIN_PATH]: "/api/login",
  [LOGOUT_PATH]: "/api/logout",
};

export function middleware(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.next();
  }

  const rewriteTarget = POST_AUTH_REWRITES[request.nextUrl.pathname];
  if (!rewriteTarget) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = rewriteTarget;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/register", "/login", "/logout"],
};
