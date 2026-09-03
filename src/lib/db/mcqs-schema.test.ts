import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREATE_MCQ_ATTEMPTS_INDEX_SQL,
  CREATE_MCQ_ATTEMPTS_TABLE_SQL,
  CREATE_MCQ_CHOICES_INDEX_SQL,
  CREATE_MCQ_CHOICES_TABLE_SQL,
  CREATE_MCQS_TABLE_SQL,
  MCQ_ATTEMPTS_COLUMNS,
  MCQ_ATTEMPTS_TABLE_NAME,
  MCQ_CHOICES_COLUMNS,
  MCQ_CHOICES_TABLE_NAME,
  MCQS_COLUMNS,
  MCQS_TABLE_NAME,
} from "./mcqs-schema";

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function findMcqsMigrationSql(): string {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir).filter((name) =>
    name.endsWith(".sql"),
  );
  const mcqsMigration = files.find((name) => /create_mcqs/i.test(name));
  if (!mcqsMigration) {
    throw new Error(
      `No create_mcqs migration found in ${migrationsDir}. Found: ${files.join(", ") || "(none)"}`,
    );
  }
  return readFileSync(join(migrationsDir, mcqsMigration), "utf8");
}

describe("Mcqs schema contract", () => {
  it("defines the Mcqs table name", () => {
    expect(MCQS_TABLE_NAME).toBe("Mcqs");
  });

  it("requires all PRD Mcqs columns", () => {
    expect([...MCQS_COLUMNS]).toEqual([
      "Id",
      "Name",
      "Question",
      "CreatedByUserId",
      "CreatedAt",
      "UpdatedAt",
    ]);
  });

  it("CREATE SQL includes every Mcqs TEXT column as NOT NULL", () => {
    for (const column of MCQS_COLUMNS) {
      expect(CREATE_MCQS_TABLE_SQL).toMatch(
        new RegExp(`\\b${column}\\s+TEXT\\s+NOT NULL\\b`, "i"),
      );
    }
  });

  it("CREATE SQL declares Mcqs Id as PRIMARY KEY", () => {
    expect(CREATE_MCQS_TABLE_SQL).toMatch(
      /\bId\s+TEXT\s+NOT NULL\s+PRIMARY KEY\b/i,
    );
  });

  it("CREATE SQL enforces UNIQUE Name and UNIQUE Question", () => {
    expect(CREATE_MCQS_TABLE_SQL).toMatch(
      /\bName\s+TEXT\s+NOT NULL\s+UNIQUE\b/i,
    );
    expect(CREATE_MCQS_TABLE_SQL).toMatch(
      /\bQuestion\s+TEXT\s+NOT NULL\s+UNIQUE\b/i,
    );
  });

  it("CREATE SQL references Users(Id) from CreatedByUserId", () => {
    expect(CREATE_MCQS_TABLE_SQL).toMatch(
      /FOREIGN KEY\s*\(\s*CreatedByUserId\s*\)\s*REFERENCES\s+Users\s*\(\s*Id\s*\)/i,
    );
  });
});

describe("McqChoices schema contract", () => {
  it("defines the McqChoices table name", () => {
    expect(MCQ_CHOICES_TABLE_NAME).toBe("McqChoices");
  });

  it("requires all PRD McqChoices columns", () => {
    expect([...MCQ_CHOICES_COLUMNS]).toEqual([
      "Id",
      "McqId",
      "Text",
      "IsCorrect",
      "Position",
    ]);
  });

  it("CREATE SQL declares McqChoices Id as PRIMARY KEY", () => {
    expect(CREATE_MCQ_CHOICES_TABLE_SQL).toMatch(
      /\bId\s+TEXT\s+NOT NULL\s+PRIMARY KEY\b/i,
    );
  });

  it("CREATE SQL requires McqId and Text as TEXT NOT NULL", () => {
    expect(CREATE_MCQ_CHOICES_TABLE_SQL).toMatch(
      /\bMcqId\s+TEXT\s+NOT NULL\b/i,
    );
    expect(CREATE_MCQ_CHOICES_TABLE_SQL).toMatch(
      /\bText\s+TEXT\s+NOT NULL\b/i,
    );
  });

  it("CREATE SQL stores IsCorrect as INTEGER NOT NULL with 0/1 CHECK", () => {
    expect(CREATE_MCQ_CHOICES_TABLE_SQL).toMatch(
      /\bIsCorrect\s+INTEGER\s+NOT NULL\s+CHECK\s*\(\s*IsCorrect\s+IN\s*\(\s*0\s*,\s*1\s*\)\s*\)/i,
    );
  });

  it("CREATE SQL stores Position as INTEGER NOT NULL", () => {
    expect(CREATE_MCQ_CHOICES_TABLE_SQL).toMatch(
      /\bPosition\s+INTEGER\s+NOT NULL\b/i,
    );
  });

  it("CREATE SQL cascades McqChoices when the parent Mcq is deleted", () => {
    expect(CREATE_MCQ_CHOICES_TABLE_SQL).toMatch(
      /FOREIGN KEY\s*\(\s*McqId\s*\)\s*REFERENCES\s+Mcqs\s*\(\s*Id\s*\)\s+ON DELETE CASCADE/i,
    );
  });

  it("indexes McqChoices by McqId", () => {
    expect(CREATE_MCQ_CHOICES_INDEX_SQL).toMatch(
      /CREATE INDEX\s+McqChoices_McqId_idx\s+ON\s+McqChoices\s*\(\s*McqId\s*\)/i,
    );
  });
});

describe("McqAttempts schema contract", () => {
  it("defines the McqAttempts table name", () => {
    expect(MCQ_ATTEMPTS_TABLE_NAME).toBe("McqAttempts");
  });

  it("requires all PRD McqAttempts columns", () => {
    expect([...MCQ_ATTEMPTS_COLUMNS]).toEqual([
      "Id",
      "McqId",
      "ChoiceId",
      "AttemptedByUserId",
      "IsCorrect",
      "CreatedAt",
    ]);
  });

  it("CREATE SQL declares McqAttempts Id as PRIMARY KEY", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /\bId\s+TEXT\s+NOT NULL\s+PRIMARY KEY\b/i,
    );
  });

  it("CREATE SQL requires McqId, AttemptedByUserId, and CreatedAt as TEXT NOT NULL", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /\bMcqId\s+TEXT\s+NOT NULL\b/i,
    );
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /\bAttemptedByUserId\s+TEXT\s+NOT NULL\b/i,
    );
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /\bCreatedAt\s+TEXT\s+NOT NULL\b/i,
    );
  });

  it("CREATE SQL allows ChoiceId to be null so edits can drop the selected choice", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(/\bChoiceId\s+TEXT\b/i);
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).not.toMatch(
      /\bChoiceId\s+TEXT\s+NOT NULL\b/i,
    );
  });

  it("CREATE SQL stores attempt IsCorrect as INTEGER NOT NULL with 0/1 CHECK", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /\bIsCorrect\s+INTEGER\s+NOT NULL\s+CHECK\s*\(\s*IsCorrect\s+IN\s*\(\s*0\s*,\s*1\s*\)\s*\)/i,
    );
  });

  it("CREATE SQL cascades McqAttempts when the parent Mcq is deleted", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /FOREIGN KEY\s*\(\s*McqId\s*\)\s*REFERENCES\s+Mcqs\s*\(\s*Id\s*\)\s+ON DELETE CASCADE/i,
    );
  });

  it("CREATE SQL nulls ChoiceId when the selected choice is deleted", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /FOREIGN KEY\s*\(\s*ChoiceId\s*\)\s*REFERENCES\s+McqChoices\s*\(\s*Id\s*\)\s+ON DELETE SET NULL/i,
    );
  });

  it("CREATE SQL references Users(Id) from AttemptedByUserId", () => {
    expect(CREATE_MCQ_ATTEMPTS_TABLE_SQL).toMatch(
      /FOREIGN KEY\s*\(\s*AttemptedByUserId\s*\)\s*REFERENCES\s+Users\s*\(\s*Id\s*\)/i,
    );
  });

  it("indexes McqAttempts by McqId", () => {
    expect(CREATE_MCQ_ATTEMPTS_INDEX_SQL).toMatch(
      /CREATE INDEX\s+McqAttempts_McqId_idx\s+ON\s+McqAttempts\s*\(\s*McqId\s*\)/i,
    );
  });
});

describe("Mcqs migration contract", () => {
  it("migration file creates all three tables with the same SQL contract", () => {
    const migrationSql = findMcqsMigrationSql();
    expect(migrationSql).toMatch(/CREATE\s+TABLE\s+Mcqs\b/i);
    expect(migrationSql).toMatch(/CREATE\s+TABLE\s+McqChoices\b/i);
    expect(migrationSql).toMatch(/CREATE\s+TABLE\s+McqAttempts\b/i);
    expect(normalizeSql(migrationSql)).toContain(
      normalizeSql(CREATE_MCQS_TABLE_SQL),
    );
    expect(normalizeSql(migrationSql)).toContain(
      normalizeSql(CREATE_MCQ_CHOICES_TABLE_SQL),
    );
    expect(normalizeSql(migrationSql)).toContain(
      normalizeSql(CREATE_MCQ_ATTEMPTS_TABLE_SQL),
    );
    expect(normalizeSql(migrationSql)).toContain(
      normalizeSql(CREATE_MCQ_CHOICES_INDEX_SQL),
    );
    expect(normalizeSql(migrationSql)).toContain(
      normalizeSql(CREATE_MCQ_ATTEMPTS_INDEX_SQL),
    );
  });
});
