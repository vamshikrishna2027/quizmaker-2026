import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const getUserById = vi.fn();
const listMcqs = vi.fn();
const getMcqById = vi.fn();
const createMcq = vi.fn();
const updateMcq = vi.fn();
const deleteMcq = vi.fn();
const createAttempt = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getDb: () => getDb(),
}));

vi.mock("@/lib/services/user-service", () => ({
  getUserById: (...args: unknown[]) => getUserById(...args),
}));

vi.mock("@/lib/services/mcq-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/mcq-service")
  >("@/lib/services/mcq-service");
  return {
    ...actual,
    listMcqs: (...args: unknown[]) => listMcqs(...args),
    getMcqById: (...args: unknown[]) => getMcqById(...args),
    createMcq: (...args: unknown[]) => createMcq(...args),
    updateMcq: (...args: unknown[]) => updateMcq(...args),
    deleteMcq: (...args: unknown[]) => deleteMcq(...args),
    createAttempt: (...args: unknown[]) => createAttempt(...args),
  };
});

import { GET as listGet, POST as createPost } from "@/app/api/mcqs/route";
import {
  DELETE as deleteById,
  GET as getById,
  PUT as updateById,
} from "@/app/api/mcqs/[id]/route";
import { GET as previewGet } from "@/app/api/mcqs/[id]/preview/route";
import { POST as createAttemptPost } from "@/app/api/mcqs/[id]/attempts/route";
import {
  McqConflictError,
  McqNotFoundError,
  McqUnauthorizedError,
  McqValidationError,
} from "@/lib/services/mcq-service";

const mockDb = {} as D1Database;

const sampleMcq = {
  id: "mcq-1",
  name: "Photosynthesis",
  question: "What gas do plants release?",
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  choices: [
    { id: "c1", text: "Oxygen", isCorrect: true, position: 0 },
    { id: "c2", text: "Nitrogen", isCorrect: false, position: 1 },
  ],
};

const createBody = {
  actorUserId: "user-1",
  name: "Photosynthesis",
  question: "What gas do plants release?",
  choices: [
    { text: "Oxygen", isCorrect: true },
    { text: "Nitrogen", isCorrect: false },
  ],
};

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/mcqs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("returns the shared bank", async () => {
    listMcqs.mockResolvedValue([
      {
        id: sampleMcq.id,
        name: sampleMcq.name,
        question: sampleMcq.question,
        createdAt: sampleMcq.createdAt,
        updatedAt: sampleMcq.updatedAt,
      },
    ]);

    const response = await listGet(new Request("http://localhost/api/mcqs"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mcqs: [
        {
          id: "mcq-1",
          name: "Photosynthesis",
          question: "What gas do plants release?",
          createdAt: sampleMcq.createdAt,
          updatedAt: sampleMcq.updatedAt,
        },
      ],
    });
    expect(listMcqs).toHaveBeenCalledWith(mockDb);
  });
});

describe("POST /api/mcqs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("creates an MCQ via the service", async () => {
    createMcq.mockResolvedValue(sampleMcq);

    const response = await createPost(
      jsonRequest("http://localhost/api/mcqs", "POST", createBody),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(sampleMcq);
    expect(createMcq).toHaveBeenCalledWith(mockDb, createBody);
  });

  it("returns 400 for service validation errors", async () => {
    createMcq.mockRejectedValue(new McqValidationError("text box is empty"));

    const response = await createPost(
      jsonRequest("http://localhost/api/mcqs", "POST", createBody),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("text box is empty");
  });

  it("returns 401 for a missing or unknown actor", async () => {
    createMcq.mockRejectedValue(new McqUnauthorizedError());

    const response = await createPost(
      jsonRequest("http://localhost/api/mcqs", "POST", {
        ...createBody,
        actorUserId: "missing",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 409 when the name already exists", async () => {
    createMcq.mockRejectedValue(new McqConflictError("name"));

    const response = await createPost(
      jsonRequest("http://localhost/api/mcqs", "POST", createBody),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.field).toBe("name");
    expect(body.error).toMatch(/name/i);
  });
});

describe("GET /api/mcqs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("returns one MCQ with choices", async () => {
    getMcqById.mockResolvedValue(sampleMcq);

    const response = await getById(
      new Request("http://localhost/api/mcqs/mcq-1"),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(sampleMcq);
    expect(getMcqById).toHaveBeenCalledWith(mockDb, "mcq-1");
  });

  it("returns 404 when the MCQ is missing", async () => {
    getMcqById.mockResolvedValue(null);

    const response = await getById(
      new Request("http://localhost/api/mcqs/missing"),
      idContext("missing"),
    );

    expect(response.status).toBe(404);
  });
});

describe("GET /api/mcqs/:id/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("omits isCorrect from choices", async () => {
    getMcqById.mockResolvedValue(sampleMcq);

    const response = await previewGet(
      new Request("http://localhost/api/mcqs/mcq-1/preview"),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.choices).toEqual([
      { id: "c1", text: "Oxygen" },
      { id: "c2", text: "Nitrogen" },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/isCorrect/);
  });
});

describe("PUT /api/mcqs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("updates an MCQ via the service", async () => {
    updateMcq.mockResolvedValue({ ...sampleMcq, name: "Plant gases" });

    const response = await updateById(
      jsonRequest("http://localhost/api/mcqs/mcq-1", "PUT", createBody),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(200);
    expect(updateMcq).toHaveBeenCalledWith(mockDb, "mcq-1", createBody);
  });

  it("returns 404 when updating a missing MCQ", async () => {
    updateMcq.mockRejectedValue(new McqNotFoundError());

    const response = await updateById(
      jsonRequest("http://localhost/api/mcqs/missing", "PUT", createBody),
      idContext("missing"),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/mcqs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("deletes an MCQ and returns 204", async () => {
    getUserById.mockResolvedValue({ id: "user-1" });
    deleteMcq.mockResolvedValue(undefined);

    const response = await deleteById(
      jsonRequest("http://localhost/api/mcqs/mcq-1", "DELETE", {
        actorUserId: "user-1",
      }),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(204);
    expect(deleteMcq).toHaveBeenCalledWith(mockDb, "mcq-1");
  });

  it("returns 401 when the actor is unknown", async () => {
    const response = await deleteById(
      jsonRequest("http://localhost/api/mcqs/mcq-1", "DELETE", {}),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(401);
    expect(deleteMcq).not.toHaveBeenCalled();
  });
});

describe("POST /api/mcqs/:id/attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("records an attempt", async () => {
    createAttempt.mockResolvedValue({
      id: "att-1",
      mcqId: "mcq-1",
      choiceId: "c1",
      isCorrect: true,
      createdAt: sampleMcq.createdAt,
    });

    const response = await createAttemptPost(
      jsonRequest("http://localhost/api/mcqs/mcq-1/attempts", "POST", {
        actorUserId: "user-1",
        choiceId: "c1",
      }),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "att-1",
      isCorrect: true,
    });
    expect(createAttempt).toHaveBeenCalledWith(mockDb, {
      actorUserId: "user-1",
      mcqId: "mcq-1",
      choiceId: "c1",
    });
  });

  it("returns 400 when choiceId is missing", async () => {
    const response = await createAttemptPost(
      jsonRequest("http://localhost/api/mcqs/mcq-1/attempts", "POST", {
        actorUserId: "user-1",
      }),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(400);
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it("returns 404 when the choice does not belong to the MCQ", async () => {
    createAttempt.mockRejectedValue(new McqNotFoundError());

    const response = await createAttemptPost(
      jsonRequest("http://localhost/api/mcqs/mcq-1/attempts", "POST", {
        actorUserId: "user-1",
        choiceId: "other",
      }),
      idContext("mcq-1"),
    );

    expect(response.status).toBe(404);
  });
});
