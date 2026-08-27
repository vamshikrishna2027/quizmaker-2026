import { redirectResponse } from "@/lib/auth/http";
import { LOGIN_PATH } from "@/lib/auth/paths";

/**
 * Logout is intentionally stateless: no cookies, sessions, or tokens to clear.
 * Clients are redirected back to the login page.
 */
export async function POST(request: Request): Promise<Response> {
  return redirectResponse(request, LOGIN_PATH);
}
