import { getDb } from "@/lib/db/client";
import { verifyPassword } from "@/lib/password";
import {
  getPasswordHashForUsernameOrEmail,
  getUserByUsernameOrEmail,
} from "@/lib/services/user-service";
import { NextResponse } from "next/server";
import {
  errorResponse,
  parseBody,
  readRequestBody,
} from "@/lib/auth/http";
import { MCQS_PATH } from "@/lib/auth/paths";
import { loginSchema } from "@/lib/auth/schemas";

const INVALID_CREDENTIALS = "Invalid username/email or password.";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);
    const parsed = parseBody(loginSchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    const { usernameOrEmail, password } = parsed.data;

    const user = await getUserByUsernameOrEmail(db, usernameOrEmail);
    const passwordHash = await getPasswordHashForUsernameOrEmail(
      db,
      usernameOrEmail,
    );

    if (!user || !passwordHash) {
      return errorResponse(INVALID_CREDENTIALS, 401);
    }

    const valid = await verifyPassword(password, passwordHash);
    if (!valid) {
      return errorResponse(INVALID_CREDENTIALS, 401);
    }

    return NextResponse.json({
      userId: user.id,
      redirectTo: MCQS_PATH,
    });
  } catch (error) {
    console.error("POST /login failed", error);
    return errorResponse("Unable to log in. Please try again.", 500);
  }
}
