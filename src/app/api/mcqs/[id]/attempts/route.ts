import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { errorResponse, parseBody, readRequestBody } from "@/lib/auth/http";
import { mcqErrorResponse } from "@/lib/mcq/http";
import { createAttemptBodySchema } from "@/lib/mcq/schemas";
import { createAttempt } from "@/lib/services/mcq-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = await readRequestBody(request);
    const parsed = parseBody(createAttemptBodySchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    const attempt = await createAttempt(db, {
      actorUserId: parsed.data.actorUserId ?? "",
      mcqId: id,
      choiceId: parsed.data.choiceId,
    });
    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    const mapped = mcqErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    console.error("POST /api/mcqs/:id/attempts failed", error);
    return errorResponse("Unable to record attempt. Please try again.", 500);
  }
}
