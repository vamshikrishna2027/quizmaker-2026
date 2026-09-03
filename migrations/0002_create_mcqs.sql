-- Migration number: 0002 	 2026-09-03T13:27:58.696Z
-- Migration: create Mcqs, McqChoices, and McqAttempts tables for Sprint 2.
CREATE TABLE Mcqs (
  Id TEXT NOT NULL PRIMARY KEY,
  Name TEXT NOT NULL UNIQUE,
  Question TEXT NOT NULL UNIQUE,
  CreatedByUserId TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL,
  FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

CREATE TABLE McqChoices (
  Id TEXT NOT NULL PRIMARY KEY,
  McqId TEXT NOT NULL,
  Text TEXT NOT NULL,
  IsCorrect INTEGER NOT NULL CHECK (IsCorrect IN (0, 1)),
  Position INTEGER NOT NULL,
  FOREIGN KEY (McqId) REFERENCES Mcqs(Id) ON DELETE CASCADE
);

CREATE INDEX McqChoices_McqId_idx ON McqChoices (McqId);

CREATE TABLE McqAttempts (
  Id TEXT NOT NULL PRIMARY KEY,
  McqId TEXT NOT NULL,
  ChoiceId TEXT,
  AttemptedByUserId TEXT NOT NULL,
  IsCorrect INTEGER NOT NULL CHECK (IsCorrect IN (0, 1)),
  CreatedAt TEXT NOT NULL,
  FOREIGN KEY (McqId) REFERENCES Mcqs(Id) ON DELETE CASCADE,
  FOREIGN KEY (ChoiceId) REFERENCES McqChoices(Id) ON DELETE SET NULL,
  FOREIGN KEY (AttemptedByUserId) REFERENCES Users(Id)
);

CREATE INDEX McqAttempts_McqId_idx ON McqAttempts (McqId);
