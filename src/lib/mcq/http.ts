import { NextResponse } from "next/server";
import { getUserById } from "@/lib/services/user-service";
import {
  McqConflictError,
  McqNotFoundError,
  McqUnauthorizedError,
  McqValidationError,
} from "@/lib/services/mcq-service";
import { errorResponse } from "@/lib/auth/http";

export async function requireActorUser(
  db: D1Database,
  actorUserId: string | undefined,
): Promise<string> {
  const trimmed = actorUserId?.trim() ?? "";
  if (!trimmed) {
    throw new McqUnauthorizedError();
  }

  const user = await getUserById(db, trimmed);
  if (!user) {
    throw new McqUnauthorizedError();
  }
  return user.id;
}

export function mcqErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof McqValidationError) {
    return errorResponse(error.message, 400);
  }
  if (error instanceof McqUnauthorizedError) {
    return errorResponse(error.message, 401);
  }
  if (error instanceof McqNotFoundError) {
    return errorResponse(error.message, 404);
  }
  if (error instanceof McqConflictError) {
    return errorResponse(error.message, 409, error.field);
  }
  return null;
}
