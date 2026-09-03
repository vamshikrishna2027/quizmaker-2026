import { getUserById } from "@/lib/services/user-service";

export type McqChoiceInput = {
  text: string;
  isCorrect: boolean;
};

export type CreateMcqInput = {
  actorUserId: string;
  name: string;
  question: string;
  choices: McqChoiceInput[];
};

export type UpdateMcqInput = CreateMcqInput;

export type CreateAttemptInput = {
  actorUserId: string;
  mcqId: string;
  choiceId: string;
};

export type McqChoiceRecord = {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
};

export type McqRecord = {
  id: string;
  name: string;
  question: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  choices: McqChoiceRecord[];
};

export type McqListItem = {
  id: string;
  name: string;
  question: string;
  createdAt: string;
  updatedAt: string;
};

export type McqAttemptRecord = {
  id: string;
  mcqId: string;
  choiceId: string | null;
  isCorrect: boolean;
  createdAt: string;
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

export class McqNotFoundError extends Error {
  constructor(message = "MCQ not found.") {
    super(message);
    this.name = "McqNotFoundError";
  }
}

export class McqConflictError extends Error {
  readonly field: "name" | "question";

  constructor(field: "name" | "question") {
    super(
      field === "name"
        ? "question name already exists"
        : "question already exists",
    );
    this.name = "McqConflictError";
    this.field = field;
  }
}

export class McqValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McqValidationError";
  }
}

export class McqUnauthorizedError extends Error {
  constructor(message = "Unknown or missing actor.") {
    super(message);
    this.name = "McqUnauthorizedError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...params: Array<string | number>
): Promise<T[]> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return results;
}

async function queryOne<T>(
  db: D1Database,
  sql: string,
  ...params: Array<string | number>
): Promise<T | null> {
  const results = await queryAll<T>(db, sql, ...params);
  return results[0] ?? null;
}

function isUniqueViolation(error: unknown, field: "Name" | "Question"): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    /UNIQUE constraint failed/i.test(error.message) &&
    error.message.includes(field)
  );
}

function mapChoice(row: ChoiceRow): McqChoiceRecord {
  return {
    id: row.Id,
    text: row.Text,
    isCorrect: row.IsCorrect === 1,
    position: row.Position,
  };
}

function mapMcq(row: McqRow, choices: ChoiceRow[]): McqRecord {
  return {
    id: row.Id,
    name: row.Name,
    question: row.Question,
    createdByUserId: row.CreatedByUserId,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
    choices: choices
      .slice()
      .sort((a, b) => a.Position - b.Position)
      .map(mapChoice),
  };
}

function mapListItem(row: McqRow): McqListItem {
  return {
    id: row.Id,
    name: row.Name,
    question: row.Question,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

async function requireActor(
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

function normalizeMcqFields(input: CreateMcqInput): {
  name: string;
  question: string;
  choices: McqChoiceInput[];
} {
  const name = input.name.trim();
  const question = input.question.trim();
  const choices = input.choices.map((choice) => ({
    text: choice.text.trim(),
    isCorrect: choice.isCorrect,
  }));

  if (!name || !question || choices.some((choice) => !choice.text)) {
    throw new McqValidationError("text box is empty");
  }

  if (choices.length < 2) {
    throw new McqValidationError("At least two choices are required.");
  }

  const correctCount = choices.filter((choice) => choice.isCorrect).length;
  if (correctCount === 0) {
    throw new McqValidationError("none of answer is selected");
  }
  if (correctCount > 1) {
    throw new McqValidationError("Exactly one correct choice is required.");
  }

  return { name, question, choices };
}

async function getMcqRowById(
  db: D1Database,
  id: string,
): Promise<McqRow | null> {
  return queryOne<McqRow>(db, "SELECT * FROM Mcqs WHERE Id = ?1", id);
}

async function getMcqRowByName(
  db: D1Database,
  name: string,
): Promise<McqRow | null> {
  return queryOne<McqRow>(db, "SELECT * FROM Mcqs WHERE Name = ?1", name);
}

async function getMcqRowByQuestion(
  db: D1Database,
  question: string,
): Promise<McqRow | null> {
  return queryOne<McqRow>(
    db,
    "SELECT * FROM Mcqs WHERE Question = ?1",
    question,
  );
}

async function getChoicesForMcq(
  db: D1Database,
  mcqId: string,
): Promise<ChoiceRow[]> {
  return queryAll<ChoiceRow>(
    db,
    "SELECT * FROM McqChoices WHERE McqId = ?1 ORDER BY Position ASC",
    mcqId,
  );
}

async function assertUniqueNameAndQuestion(
  db: D1Database,
  name: string,
  question: string,
  excludeId?: string,
): Promise<void> {
  const existingName = await getMcqRowByName(db, name);
  if (existingName && existingName.Id !== excludeId) {
    throw new McqConflictError("name");
  }

  const existingQuestion = await getMcqRowByQuestion(db, question);
  if (existingQuestion && existingQuestion.Id !== excludeId) {
    throw new McqConflictError("question");
  }
}

async function insertChoices(
  db: D1Database,
  mcqId: string,
  choices: McqChoiceInput[],
): Promise<void> {
  for (const [index, choice] of choices.entries()) {
    await db
      .prepare(
        `INSERT INTO McqChoices (Id, McqId, Text, IsCorrect, Position)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
      .bind(
        crypto.randomUUID(),
        mcqId,
        choice.text,
        choice.isCorrect ? 1 : 0,
        index,
      )
      .run();
  }
}

export async function listMcqs(db: D1Database): Promise<McqListItem[]> {
  const rows = await queryAll<McqRow>(
    db,
    "SELECT * FROM Mcqs ORDER BY UpdatedAt DESC",
  );
  return rows.map(mapListItem);
}

export async function getMcqById(
  db: D1Database,
  id: string,
): Promise<McqRecord | null> {
  const row = await getMcqRowById(db, id);
  if (!row) {
    return null;
  }
  const choices = await getChoicesForMcq(db, id);
  return mapMcq(row, choices);
}

export async function createMcq(
  db: D1Database,
  input: CreateMcqInput,
): Promise<McqRecord> {
  const actorId = await requireActor(db, input.actorUserId);
  const { name, question, choices } = normalizeMcqFields(input);
  await assertUniqueNameAndQuestion(db, name, question);

  const id = crypto.randomUUID();
  const timestamp = nowIso();

  try {
    await db
      .prepare(
        `INSERT INTO Mcqs (Id, Name, Question, CreatedByUserId, CreatedAt, UpdatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(id, name, question, actorId, timestamp, timestamp)
      .run();
  } catch (error) {
    if (isUniqueViolation(error, "Name")) {
      throw new McqConflictError("name");
    }
    if (isUniqueViolation(error, "Question")) {
      throw new McqConflictError("question");
    }
    throw error;
  }

  await insertChoices(db, id, choices);

  const created = await getMcqById(db, id);
  if (!created) {
    throw new Error("Failed to load MCQ after create.");
  }
  return created;
}

export async function updateMcq(
  db: D1Database,
  id: string,
  input: UpdateMcqInput,
): Promise<McqRecord> {
  await requireActor(db, input.actorUserId);

  const existing = await getMcqRowById(db, id);
  if (!existing) {
    throw new McqNotFoundError();
  }

  const { name, question, choices } = normalizeMcqFields(input);
  await assertUniqueNameAndQuestion(db, name, question, id);

  const updatedAt = nowIso();

  try {
    await db
      .prepare(
        `UPDATE Mcqs
         SET Name = ?1,
             Question = ?2,
             UpdatedAt = ?3
         WHERE Id = ?4`,
      )
      .bind(name, question, updatedAt, id)
      .run();
  } catch (error) {
    if (isUniqueViolation(error, "Name")) {
      throw new McqConflictError("name");
    }
    if (isUniqueViolation(error, "Question")) {
      throw new McqConflictError("question");
    }
    throw error;
  }

  await db
    .prepare("DELETE FROM McqChoices WHERE McqId = ?1")
    .bind(id)
    .run();
  await insertChoices(db, id, choices);

  const updated = await getMcqById(db, id);
  if (!updated) {
    throw new McqNotFoundError();
  }
  return updated;
}

export async function deleteMcq(db: D1Database, id: string): Promise<void> {
  const existing = await getMcqById(db, id);
  if (!existing) {
    throw new McqNotFoundError();
  }

  await db.prepare("DELETE FROM Mcqs WHERE Id = ?1").bind(id).run();
}

export async function createAttempt(
  db: D1Database,
  input: CreateAttemptInput,
): Promise<McqAttemptRecord> {
  const actorId = await requireActor(db, input.actorUserId);

  const mcq = await getMcqRowById(db, input.mcqId);
  if (!mcq) {
    throw new McqNotFoundError();
  }

  const choice = await queryOne<ChoiceRow>(
    db,
    "SELECT * FROM McqChoices WHERE Id = ?1",
    input.choiceId,
  );
  if (!choice || choice.McqId !== input.mcqId) {
    throw new McqNotFoundError("Choice not found for this MCQ.");
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();

  await db
    .prepare(
      `INSERT INTO McqAttempts (Id, McqId, ChoiceId, AttemptedByUserId, IsCorrect, CreatedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(id, input.mcqId, choice.Id, actorId, choice.IsCorrect, createdAt)
    .run();

  return {
    id,
    mcqId: input.mcqId,
    choiceId: choice.Id,
    isCorrect: choice.IsCorrect === 1,
    createdAt,
  };
}
