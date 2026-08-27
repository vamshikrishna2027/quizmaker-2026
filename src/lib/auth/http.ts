import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export async function readRequestBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = await request.json();
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
    return {};
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") {
        body[key] = value;
      }
    }
    return body;
  }

  try {
    const json = await request.json();
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
  } catch {
    // Empty or non-JSON body
  }

  return {};
}

export function parseBody<T>(
  schema: ZodType<T>,
  body: Record<string, unknown>,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    response: validationErrorResponse(result.error),
  };
}

export function validationErrorResponse(error: ZodError): NextResponse {
  const first = error.issues[0];
  return NextResponse.json(
    {
      error: first?.message ?? "Invalid request.",
      field: first?.path[0] ? String(first.path[0]) : undefined,
    },
    { status: 400 },
  );
}

export function redirectResponse(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export function errorResponse(
  message: string,
  status: number,
  field?: string,
): NextResponse {
  return NextResponse.json(
    { error: message, ...(field ? { field } : {}) },
    { status },
  );
}
