import { LOGIN_PATH, LOGOUT_PATH, MCQS_PATH } from "@/lib/auth/paths";
import { clearActorUserId, storeActorUserId } from "@/lib/mcq/actor";

export type AuthSubmitResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

function successRedirectPath(url: string): string {
  if (url.includes(LOGOUT_PATH)) {
    return LOGIN_PATH;
  }
  return MCQS_PATH;
}

function isLogoutUrl(url: string): boolean {
  return url.includes(LOGOUT_PATH);
}

/**
 * POST JSON to an auth route handler and follow success in the browser.
 */
export async function submitAuthRequest(
  url: string,
  body: Record<string, string>,
): Promise<AuthSubmitResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });

  if (isLogoutUrl(url)) {
    clearActorUserId();
  }

  // Browsers may hide headers on opaqueredirect even for same-origin 303 responses.
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  ) {
    const location =
      response.headers.get("Location") ?? successRedirectPath(url);
    window.location.assign(location);
    return { ok: true };
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      field?: string;
    } | null;
    return {
      ok: false,
      error: data?.error ?? "Request failed. Please try again.",
      field: data?.field,
    };
  }

  const data = (await response.json().catch(() => null)) as {
    userId?: string;
    redirectTo?: string;
  } | null;

  if (data?.userId) {
    storeActorUserId(data.userId);
  }

  if (data?.redirectTo) {
    window.location.assign(data.redirectTo);
  }

  return { ok: true };
}
