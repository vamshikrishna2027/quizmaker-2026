import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { errorResponse, parseBody, readRequestBody } from "@/lib/auth/http";
import { mcqErrorResponse, requireActorUser } from "@/lib/mcq/http";
import { deleteMcqBodySchema, upsertMcqBodySchema } from "@/lib/mcq/schemas";
import {
  deleteMcq,
  getMcqById,
  McqNotFoundError,
  updateMcq,
} from "@/lib/services/mcq-service";

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
    return NextResponse.json(mcq);
  } catch (error) {
    const mapped = mcqErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    console.error("GET /api/mcqs/:id failed", error);
    return errorResponse("Unable to load question. Please try again.", 500);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = await readRequestBody(request);
    const parsed = parseBody(upsertMcqBodySchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    const mcq = await updateMcq(db, id, {
      actorUserId: parsed.data.actorUserId ?? "",
      name: parsed.data.name,
      question: parsed.data.question,
      choices: parsed.data.choices,
    });
    return NextResponse.json(mcq);
  } catch (error) {
    const mapped = mcqErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    console.error("PUT /api/mcqs/:id failed", error);
    return errorResponse("Unable to update question. Please try again.", 500);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const body = await readRequestBody(request);
    const parsed = parseBody(deleteMcqBodySchema, {
      ...body,
      actorUserId:
        (typeof body.actorUserId === "string" && body.actorUserId) ||
        url.searchParams.get("actorUserId") ||
        undefined,
    });
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    await requireActorUser(db, parsed.data.actorUserId);
    await deleteMcq(db, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof McqNotFoundError) {
      return errorResponse(error.message, 404);
    }
    const mapped = mcqErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    console.error("DELETE /api/mcqs/:id failed", error);
    return errorResponse("Unable to delete question. Please try again.", 500);
  }
}
