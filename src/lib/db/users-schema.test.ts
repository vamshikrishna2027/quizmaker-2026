import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREATE_USERS_TABLE_SQL,
  USERS_COLUMNS,
  USERS_TABLE_NAME,
} from "./users-schema";

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function findUsersMigrationSql(): string {
  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir).filter((name) =>
    name.endsWith(".sql"),
  );
  const usersMigration = files.find((name) =>
    /create_users/i.test(name),
  );
  if (!usersMigration) {
    throw new Error(
      `No create_users migration found in ${migrationsDir}. Found: ${files.join(", ") || "(none)"}`,
    );
  }
  return readFileSync(join(migrationsDir, usersMigration), "utf8");
}

describe("Users schema contract", () => {
  it("defines the Users table name", () => {
    expect(USERS_TABLE_NAME).toBe("Users");
  });

  it("requires all PRD columns", () => {
    expect([...USERS_COLUMNS]).toEqual([
      "Id",
      "FirstName",
      "LastName",
      "Username",
      "Email",
      "PasswordHash",
      "CreatedAt",
      "UpdatedAt",
    ]);
  });

  it("CREATE SQL includes every required column as NOT NULL", () => {
    for (const column of USERS_COLUMNS) {
      expect(CREATE_USERS_TABLE_SQL).toMatch(
        new RegExp(`\\b${column}\\s+TEXT\\s+NOT NULL\\b`, "i"),
      );
    }
  });

  it("CREATE SQL declares Id as PRIMARY KEY", () => {
    expect(CREATE_USERS_TABLE_SQL).toMatch(
      /\bId\s+TEXT\s+NOT NULL\s+PRIMARY KEY\b/i,
    );
  });

  it("CREATE SQL enforces UNIQUE Username and UNIQUE Email", () => {
    expect(CREATE_USERS_TABLE_SQL).toMatch(
      /\bUsername\s+TEXT\s+NOT NULL\s+UNIQUE\b/i,
    );
    expect(CREATE_USERS_TABLE_SQL).toMatch(
      /\bEmail\s+TEXT\s+NOT NULL\s+UNIQUE\b/i,
    );
  });

  it("migration file creates Users with the same SQL contract", () => {
    const migrationSql = findUsersMigrationSql();
    expect(migrationSql).toMatch(/CREATE\s+TABLE\s+Users\b/i);
    expect(normalizeSql(migrationSql)).toContain(
      normalizeSql(CREATE_USERS_TABLE_SQL),
    );
  });
});
