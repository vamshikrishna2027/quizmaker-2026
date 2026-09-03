import { getDb } from "@/lib/db/client";
import {
  createUser,
  UserConflictError,
} from "@/lib/services/user-service";
import { NextResponse } from "next/server";
import {
  errorResponse,
  parseBody,
  readRequestBody,
} from "@/lib/auth/http";
import { MCQS_PATH } from "@/lib/auth/paths";
import { registerSchema } from "@/lib/auth/schemas";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);
    const parsed = parseBody(registerSchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    const user = await createUser(db, parsed.data);
    return NextResponse.json({
      userId: user.id,
      redirectTo: MCQS_PATH,
    });
  } catch (error) {
    if (error instanceof UserConflictError) {
      return errorResponse(error.message, 409, error.field);
    }

    console.error("POST /register failed", error);
    return errorResponse("Unable to register. Please try again.", 500);
  }
}
