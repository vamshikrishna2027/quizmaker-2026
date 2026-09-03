import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { errorResponse } from "@/lib/auth/http";
import { mcqErrorResponse } from "@/lib/mcq/http";
import { getMcqById } from "@/lib/services/mcq-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { id } = await context.params;
    const db = await getDb();
    const mcq = await getMcqById(db, id);
    if (!mcq) {
      return errorResponse("MCQ not found.", 404);
    }

    return NextResponse.json({
      id: mcq.id,
      name: mcq.name,
      question: mcq.question,
      choices: mcq.choices.map((choice) => ({
        id: choice.id,
        text: choice.text,
      })),
    });
  } catch (error) {
    const mapped = mcqErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    console.error("GET /api/mcqs/:id/preview failed", error);
    return errorResponse("Unable to load preview. Please try again.", 500);
  }
}
