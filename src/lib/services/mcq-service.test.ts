import { beforeEach, describe, expect, it } from "vitest";
import {
  createAttempt,
  createMcq,
  deleteMcq,
  getMcqById,
  listMcqs,
  McqConflictError,
  McqNotFoundError,
  McqUnauthorizedError,
  McqValidationError,
  updateMcq,
  type CreateMcqInput,
} from "./mcq-service";

type UserRow = {
  Id: string;
  FirstName: string;
  LastName: string;
  Username: string;
  Email: string;
  PasswordHash: string;
  CreatedAt: string;
  UpdatedAt: string;
};

type McqRow = {
  Id: string;
  Name: string;
  Question: string;
  CreatedByUserId: string;
  CreatedAt: string;
  UpdatedAt: string;
};

type ChoiceRow = {
  Id: string;
  McqId: string;
  Text: string;
  IsCorrect: number;
  Position: number;
};

type AttemptRow = {
  Id: string;
  McqId: string;
  ChoiceId: string | null;
  AttemptedByUserId: string;
  IsCorrect: number;
  CreatedAt: string;
};

function createMemoryDb() {
  const users: UserRow[] = [];
  const mcqs: McqRow[] = [];
  const choices: ChoiceRow[] = [];
  const attempts: AttemptRow[] = [];

  function executeRun(sql: string, params: unknown[]) {
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (/^INSERT INTO Mcqs/i.test(normalized)) {
      const [Id, Name, Question, CreatedByUserId, CreatedAt, UpdatedAt] =
        params as string[];
      if (mcqs.some((row) => row.Name === Name)) {
        throw new Error("UNIQUE constraint failed: Mcqs.Name");
      }
      if (mcqs.some((row) => row.Question === Question)) {
        throw new Error("UNIQUE constraint failed: Mcqs.Question");
      }
      mcqs.push({
        Id,
        Name,
        Question,
        CreatedByUserId,
        CreatedAt,
        UpdatedAt,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (/^INSERT INTO McqChoices/i.test(normalized)) {
      const [Id, McqId, Text, IsCorrect, Position] = params as [
        string,
        string,
        string,
        number,
        number,
      ];
      choices.push({
        Id,
        McqId,
        Text,
        IsCorrect: Number(IsCorrect),
        Position: Number(Position),
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (/^INSERT INTO McqAttempts/i.test(normalized)) {
      const [Id, McqId, ChoiceId, AttemptedByUserId, IsCorrect, CreatedAt] =
        params as [string, string, string, string, number, string];
      attempts.push({
        Id,
        McqId,
        ChoiceId,
        AttemptedByUserId,
        IsCorrect: Number(IsCorrect),
        CreatedAt,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (/^UPDATE Mcqs SET/i.test(normalized)) {
      const [Name, Question, UpdatedAt, Id] = params as string[];
      const index = mcqs.findIndex((row) => row.Id === Id);
      if (index === -1) {
        return { success: true, meta: { changes: 0 } };
      }
      if (mcqs.some((row) => row.Name === Name && row.Id !== Id)) {
        throw new Error("UNIQUE constraint failed: Mcqs.Name");
      }
      if (mcqs.some((row) => row.Question === Question && row.Id !== Id)) {
        throw new Error("UNIQUE constraint failed: Mcqs.Question");
      }
      mcqs[index] = {
        ...mcqs[index],
        Name,
        Question,
        UpdatedAt,
      };
      return { success: true, meta: { changes: 1 } };
    }

    if (/^DELETE FROM McqChoices WHERE McqId = \?1/i.test(normalized)) {
      const mcqId = params[0] as string;
      const removedIds = new Set(
        choices.filter((row) => row.McqId === mcqId).map((row) => row.Id),
      );
      const next = choices.filter((row) => row.McqId !== mcqId);
      choices.length = 0;
      choices.push(...next);
      for (const attempt of attempts) {
        if (attempt.ChoiceId && removedIds.has(attempt.ChoiceId)) {
          attempt.ChoiceId = null;
        }
      }
      return { success: true, meta: { changes: removedIds.size } };
    }

    if (/^DELETE FROM Mcqs WHERE Id = \?1/i.test(normalized)) {
      const id = params[0] as string;
      const before = mcqs.length;
      const nextMcqs = mcqs.filter((row) => row.Id !== id);
      mcqs.length = 0;
      mcqs.push(...nextMcqs);
      const nextChoices = choices.filter((row) => row.McqId !== id);
      choices.length = 0;
      choices.push(...nextChoices);
      const nextAttempts = attempts.filter((row) => row.McqId !== id);
      attempts.length = 0;
      attempts.push(...nextAttempts);
      return {
        success: true,
        meta: { changes: before === mcqs.length ? 0 : 1 },
      };
    }

    throw new Error(`Unsupported run SQL in memory db: ${normalized}`);
  }

  function executeAll<T>(sql: string, params: unknown[]): { results: T[] } {
    const normalized = sql.replace(/\s+/g, " ").trim();

    if (/FROM Users WHERE Id = \?1/i.test(normalized)) {
      return {
        results: users.filter((row) => row.Id === params[0]) as T[],
      };
    }

    if (/FROM Mcqs WHERE Name = \?1/i.test(normalized)) {
      return {
        results: mcqs.filter((row) => row.Name === params[0]) as T[],
      };
    }

    if (/FROM Mcqs WHERE Question = \?1/i.test(normalized)) {
      return {
        results: mcqs.filter((row) => row.Question === params[0]) as T[],
      };
    }

    if (/FROM Mcqs WHERE Id = \?1/i.test(normalized)) {
      return {
        results: mcqs.filter((row) => row.Id === params[0]) as T[],
      };
    }

    if (/FROM Mcqs ORDER BY UpdatedAt DESC/i.test(normalized)) {
      return {
        results: [...mcqs].sort((a, b) =>
          b.UpdatedAt.localeCompare(a.UpdatedAt),
        ) as T[],
      };
    }

    if (/FROM McqChoices WHERE Id = \?1/i.test(normalized)) {
      return {
        results: choices.filter((row) => row.Id === params[0]) as T[],
      };
    }

    if (/FROM McqChoices WHERE McqId = \?1/i.test(normalized)) {
      const rows = choices
        .filter((row) => row.McqId === params[0])
        .sort((a, b) => a.Position - b.Position);
      return { results: rows as T[] };
    }

    throw new Error(`Unsupported all SQL in memory db: ${normalized}`);
  }

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              return executeRun(sql, params);
            },
            async all<T>() {
              return executeAll<T>(sql, params);
            },
          };
        },
      };
    },
    async batch(
      statements: Array<{ run: () => Promise<unknown> }>,
    ) {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
    __users: users,
    __mcqs: mcqs,
    __choices: choices,
    __attempts: attempts,
  };

  return db as unknown as D1Database & {
    __users: UserRow[];
    __mcqs: McqRow[];
    __choices: ChoiceRow[];
    __attempts: AttemptRow[];
  };
}

const ACTOR_ID = "user-ada";

function seedActor(
  db: D1Database & { __users: UserRow[] },
  id = ACTOR_ID,
) {
  db.__users.push({
    Id: id,
    FirstName: "Ada",
    LastName: "Lovelace",
    Username: "ada",
    Email: "ada@example.com",
    PasswordHash: "hash",
    CreatedAt: "2026-01-01T00:00:00.000Z",
    UpdatedAt: "2026-01-01T00:00:00.000Z",
  });
  return id;
}

function validInput(
  overrides: Partial<CreateMcqInput> = {},
): CreateMcqInput {
  return {
    actorUserId: ACTOR_ID,
    name: "Photosynthesis",
    question: "What gas do plants release?",
    choices: [
      { text: "Oxygen", isCorrect: true },
      { text: "Nitrogen", isCorrect: false },
    ],
    ...overrides,
  };
}

describe("mcqService", () => {
  let db: D1Database & {
    __users: UserRow[];
    __mcqs: McqRow[];
    __choices: ChoiceRow[];
    __attempts: AttemptRow[];
  };

  beforeEach(() => {
    db = createMemoryDb();
    seedActor(db);
  });

  it("creates an MCQ with trimmed fields and ordered choices", async () => {
    const created = await createMcq(
      db,
      validInput({
        name: "  Photosynthesis  ",
        question: "  What gas do plants release?  ",
        choices: [
          { text: "  Oxygen  ", isCorrect: true },
          { text: "  Nitrogen  ", isCorrect: false },
        ],
      }),
    );

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Photosynthesis");
    expect(created.question).toBe("What gas do plants release?");
    expect(created.createdByUserId).toBe(ACTOR_ID);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
    expect(created.choices).toEqual([
      expect.objectContaining({
        text: "Oxygen",
        isCorrect: true,
        position: 0,
      }),
      expect.objectContaining({
        text: "Nitrogen",
        isCorrect: false,
        position: 1,
      }),
    ]);
    expect(created.choices[0].id).toBeTruthy();
  });

  it("rejects empty name, question, or choice text", async () => {
    await expect(
      createMcq(db, validInput({ name: "   " })),
    ).rejects.toBeInstanceOf(McqValidationError);
    await expect(createMcq(db, validInput({ name: "   " }))).rejects.toThrow(
      /text box is empty/i,
    );

    await expect(
      createMcq(db, validInput({ question: "" })),
    ).rejects.toThrow(/text box is empty/i);

    await expect(
      createMcq(
        db,
        validInput({
          choices: [
            { text: "Oxygen", isCorrect: true },
            { text: "   ", isCorrect: false },
          ],
        }),
      ),
    ).rejects.toThrow(/text box is empty/i);
  });

  it("rejects fewer than two choices", async () => {
    await expect(
      createMcq(
        db,
        validInput({
          choices: [{ text: "Oxygen", isCorrect: true }],
        }),
      ),
    ).rejects.toBeInstanceOf(McqValidationError);
  });

  it("rejects a missing correct choice", async () => {
    await expect(
      createMcq(
        db,
        validInput({
          choices: [
            { text: "Oxygen", isCorrect: false },
            { text: "Nitrogen", isCorrect: false },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(McqValidationError);
    await expect(
      createMcq(
        db,
        validInput({
          choices: [
            { text: "Oxygen", isCorrect: false },
            { text: "Nitrogen", isCorrect: false },
          ],
        }),
      ),
    ).rejects.toThrow(/none of answer is selected/i);
  });

  it("rejects more than one correct choice", async () => {
    await expect(
      createMcq(
        db,
        validInput({
          choices: [
            { text: "Oxygen", isCorrect: true },
            { text: "Nitrogen", isCorrect: true },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(McqValidationError);
  });

  it("rejects a duplicate name", async () => {
    await createMcq(db, validInput());

    await expect(
      createMcq(
        db,
        validInput({
          question: "A different question?",
        }),
      ),
    ).rejects.toBeInstanceOf(McqConflictError);
    await expect(
      createMcq(
        db,
        validInput({
          question: "A different question?",
        }),
      ),
    ).rejects.toThrow(/name/i);
  });

  it("rejects a duplicate question", async () => {
    await createMcq(db, validInput());

    await expect(
      createMcq(
        db,
        validInput({
          name: "Different name",
        }),
      ),
    ).rejects.toBeInstanceOf(McqConflictError);
    await expect(
      createMcq(
        db,
        validInput({
          name: "Different name",
        }),
      ),
    ).rejects.toThrow(/question/i);
  });

  it("rejects an unknown or missing actor", async () => {
    await expect(
      createMcq(db, validInput({ actorUserId: "missing-user" })),
    ).rejects.toBeInstanceOf(McqUnauthorizedError);

    await expect(
      createMcq(db, validInput({ actorUserId: "   " })),
    ).rejects.toBeInstanceOf(McqUnauthorizedError);
  });

  it("lists MCQs newest UpdatedAt first without embedding choices", async () => {
    const first = await createMcq(db, validInput());
    const second = await createMcq(
      db,
      validInput({
        name: "Gravity",
        question: "What pulls objects toward Earth?",
      }),
    );
    db.__mcqs.find((row) => row.Id === first.id)!.UpdatedAt =
      "2026-01-01T00:00:00.000Z";
    db.__mcqs.find((row) => row.Id === second.id)!.UpdatedAt =
      "2026-01-02T00:00:00.000Z";

    const listed = await listMcqs(db);

    expect(listed.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(listed[0]).toMatchObject({
      id: second.id,
      name: "Gravity",
      question: "What pulls objects toward Earth?",
    });
    expect(listed[0]).not.toHaveProperty("choices");
  });

  it("reads an MCQ by id with choices in Position order", async () => {
    const created = await createMcq(db, validInput());
    await expect(getMcqById(db, created.id)).resolves.toEqual(created);
  });

  it("returns null when an MCQ is missing", async () => {
    await expect(getMcqById(db, "missing")).resolves.toBeNull();
  });

  it("updates an MCQ and replaces its choices", async () => {
    const created = await createMcq(db, validInput());
    const updated = await updateMcq(db, created.id, {
      actorUserId: ACTOR_ID,
      name: "Plant gases",
      question: "Which gas do plants release during photosynthesis?",
      choices: [
        { text: "Carbon dioxide", isCorrect: false },
        { text: "Oxygen", isCorrect: true },
        { text: "Helium", isCorrect: false },
      ],
    });

    expect(updated.name).toBe("Plant gases");
    expect(updated.question).toBe(
      "Which gas do plants release during photosynthesis?",
    );
    expect(updated.choices).toHaveLength(3);
    expect(updated.choices.map((choice) => choice.text)).toEqual([
      "Carbon dioxide",
      "Oxygen",
      "Helium",
    ]);
    expect(updated.choices.find((choice) => choice.isCorrect)?.text).toBe(
      "Oxygen",
    );
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
    expect(db.__choices).toHaveLength(3);
  });

  it("allows keeping the same name and question on update", async () => {
    const created = await createMcq(db, validInput());

    const updated = await updateMcq(db, created.id, {
      actorUserId: ACTOR_ID,
      name: created.name,
      question: created.question,
      choices: [
        { text: "Oxygen", isCorrect: true },
        { text: "Argon", isCorrect: false },
      ],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.choices.map((choice) => choice.text)).toEqual([
      "Oxygen",
      "Argon",
    ]);
  });

  it("rejects an update that collides with another MCQ name", async () => {
    await createMcq(db, validInput());
    const other = await createMcq(
      db,
      validInput({
        name: "Gravity",
        question: "What pulls objects toward Earth?",
      }),
    );

    await expect(
      updateMcq(db, other.id, {
        actorUserId: ACTOR_ID,
        name: "Photosynthesis",
        question: "What pulls objects toward Earth?",
        choices: [
          { text: "Mass", isCorrect: true },
          { text: "Luck", isCorrect: false },
        ],
      }),
    ).rejects.toBeInstanceOf(McqConflictError);
  });

  it("throws when updating a missing MCQ", async () => {
    await expect(
      updateMcq(db, "missing", validInput()),
    ).rejects.toBeInstanceOf(McqNotFoundError);
  });

  it("deletes an MCQ and cascades choices and attempts", async () => {
    const created = await createMcq(db, validInput());
    await createAttempt(db, {
      actorUserId: ACTOR_ID,
      mcqId: created.id,
      choiceId: created.choices[0].id,
    });

    await deleteMcq(db, created.id);

    await expect(getMcqById(db, created.id)).resolves.toBeNull();
    expect(db.__mcqs).toHaveLength(0);
    expect(db.__choices).toHaveLength(0);
    expect(db.__attempts).toHaveLength(0);
  });

  it("throws when deleting a missing MCQ", async () => {
    await expect(deleteMcq(db, "missing")).rejects.toBeInstanceOf(
      McqNotFoundError,
    );
  });

  it("records a correct attempt snapshot", async () => {
    const created = await createMcq(db, validInput());
    const attempt = await createAttempt(db, {
      actorUserId: ACTOR_ID,
      mcqId: created.id,
      choiceId: created.choices[0].id,
    });

    expect(attempt.mcqId).toBe(created.id);
    expect(attempt.choiceId).toBe(created.choices[0].id);
    expect(attempt.isCorrect).toBe(true);
    expect(attempt.createdAt).toBeTruthy();
  });

  it("records an incorrect attempt snapshot", async () => {
    const created = await createMcq(db, validInput());
    const attempt = await createAttempt(db, {
      actorUserId: ACTOR_ID,
      mcqId: created.id,
      choiceId: created.choices[1].id,
    });

    expect(attempt.isCorrect).toBe(false);
  });

  it("allows multiple attempts against the same MCQ", async () => {
    const created = await createMcq(db, validInput());

    const first = await createAttempt(db, {
      actorUserId: ACTOR_ID,
      mcqId: created.id,
      choiceId: created.choices[1].id,
    });
    const second = await createAttempt(db, {
      actorUserId: ACTOR_ID,
      mcqId: created.id,
      choiceId: created.choices[0].id,
    });

    expect(first.id).not.toBe(second.id);
    expect(db.__attempts).toHaveLength(2);
  });

  it("rejects an attempt whose choice belongs to another MCQ", async () => {
    const first = await createMcq(db, validInput());
    const second = await createMcq(
      db,
      validInput({
        name: "Gravity",
        question: "What pulls objects toward Earth?",
      }),
    );

    await expect(
      createAttempt(db, {
        actorUserId: ACTOR_ID,
        mcqId: second.id,
        choiceId: first.choices[0].id,
      }),
    ).rejects.toBeInstanceOf(McqNotFoundError);
  });

  it("rejects an attempt against a missing MCQ", async () => {
    await expect(
      createAttempt(db, {
        actorUserId: ACTOR_ID,
        mcqId: "missing",
        choiceId: "choice-1",
      }),
    ).rejects.toBeInstanceOf(McqNotFoundError);
  });

  it("rejects an attempt from an unknown actor", async () => {
    const created = await createMcq(db, validInput());

    await expect(
      createAttempt(db, {
        actorUserId: "missing-user",
        mcqId: created.id,
        choiceId: created.choices[0].id,
      }),
    ).rejects.toBeInstanceOf(McqUnauthorizedError);
  });
});
