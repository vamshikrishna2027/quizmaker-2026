/**
 * Canonical Mcqs / McqChoices / McqAttempts schema for Sprint 2.
 * Keep D1 migrations in sync with the CREATE_*_SQL exports.
 */
export const MCQS_TABLE_NAME = "Mcqs" as const;
export const MCQ_CHOICES_TABLE_NAME = "McqChoices" as const;
export const MCQ_ATTEMPTS_TABLE_NAME = "McqAttempts" as const;

export const MCQS_COLUMNS = [
  "Id",
  "Name",
  "Question",
  "CreatedByUserId",
  "CreatedAt",
  "UpdatedAt",
] as const;

export const MCQ_CHOICES_COLUMNS = [
  "Id",
  "McqId",
  "Text",
  "IsCorrect",
  "Position",
] as const;

export const MCQ_ATTEMPTS_COLUMNS = [
  "Id",
  "McqId",
  "ChoiceId",
  "AttemptedByUserId",
  "IsCorrect",
  "CreatedAt",
] as const;

export type McqsColumn = (typeof MCQS_COLUMNS)[number];
export type McqChoicesColumn = (typeof MCQ_CHOICES_COLUMNS)[number];
export type McqAttemptsColumn = (typeof MCQ_ATTEMPTS_COLUMNS)[number];

export const CREATE_MCQS_TABLE_SQL = `CREATE TABLE Mcqs (
  Id TEXT NOT NULL PRIMARY KEY,
  Name TEXT NOT NULL UNIQUE,
  Question TEXT NOT NULL UNIQUE,
  CreatedByUserId TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL,
  FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);`;

export const CREATE_MCQ_CHOICES_TABLE_SQL = `CREATE TABLE McqChoices (
  Id TEXT NOT NULL PRIMARY KEY,
  McqId TEXT NOT NULL,
  Text TEXT NOT NULL,
  IsCorrect INTEGER NOT NULL CHECK (IsCorrect IN (0, 1)),
  Position INTEGER NOT NULL,
  FOREIGN KEY (McqId) REFERENCES Mcqs(Id) ON DELETE CASCADE
);`;

export const CREATE_MCQ_CHOICES_INDEX_SQL =
  "CREATE INDEX McqChoices_McqId_idx ON McqChoices (McqId);";

export const CREATE_MCQ_ATTEMPTS_TABLE_SQL = `CREATE TABLE McqAttempts (
  Id TEXT NOT NULL PRIMARY KEY,
  McqId TEXT NOT NULL,
  ChoiceId TEXT,
  AttemptedByUserId TEXT NOT NULL,
  IsCorrect INTEGER NOT NULL CHECK (IsCorrect IN (0, 1)),
  CreatedAt TEXT NOT NULL,
  FOREIGN KEY (McqId) REFERENCES Mcqs(Id) ON DELETE CASCADE,
  FOREIGN KEY (ChoiceId) REFERENCES McqChoices(Id) ON DELETE SET NULL,
  FOREIGN KEY (AttemptedByUserId) REFERENCES Users(Id)
);`;

export const CREATE_MCQ_ATTEMPTS_INDEX_SQL =
  "CREATE INDEX McqAttempts_McqId_idx ON McqAttempts (McqId);";
