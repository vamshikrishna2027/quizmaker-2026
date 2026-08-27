import { getDb } from "@/lib/db/client";
import {
  createUser,
  UserConflictError,
} from "@/lib/services/user-service";
import {
  errorResponse,
  parseBody,
  readRequestBody,
  redirectResponse,
} from "@/lib/auth/http";
import { MCQ_STUB_PATH } from "@/lib/auth/paths";
import { registerSchema } from "@/lib/auth/schemas";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);
    const parsed = parseBody(registerSchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    await createUser(db, parsed.data);
    return redirectResponse(request, MCQ_STUB_PATH);
  } catch (error) {
    if (error instanceof UserConflictError) {
      return errorResponse(error.message, 409, error.field);
    }

    console.error("POST /register failed", error);
    return errorResponse("Unable to register. Please try again.", 500);
  }
}
