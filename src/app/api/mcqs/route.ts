import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { errorResponse, parseBody, readRequestBody } from "@/lib/auth/http";
import { mcqErrorResponse } from "@/lib/mcq/http";
import { upsertMcqBodySchema } from "@/lib/mcq/schemas";
import { createMcq, listMcqs } from "@/lib/services/mcq-service";

export async function GET(): Promise<Response> {
  try {
    const db = await getDb();
    const mcqs = await listMcqs(db);
    return NextResponse.json({ mcqs });
  } catch (error) {
    console.error("GET /api/mcqs failed", error);
    return errorResponse("Unable to list questions. Please try again.", 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);
    const parsed = parseBody(upsertMcqBodySchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const db = await getDb();
    const mcq = await createMcq(db, {
      actorUserId: parsed.data.actorUserId ?? "",
      name: parsed.data.name,
      question: parsed.data.question,
      choices: parsed.data.choices,
    });
    return NextResponse.json(mcq, { status: 201 });
  } catch (error) {
    const mapped = mcqErrorResponse(error);
    if (mapped) {
      return mapped;
    }
    console.error("POST /api/mcqs failed", error);
    return errorResponse("Unable to create question. Please try again.", 500);
  }
}
