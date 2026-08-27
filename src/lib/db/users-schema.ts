/**
 * Canonical Users table schema for Sprint 1.
 * Keep D1 migrations in sync with CREATE_USERS_TABLE_SQL.
 */
export const USERS_TABLE_NAME = "Users" as const;

export const USERS_COLUMNS = [
  "Id",
  "FirstName",
  "LastName",
  "Username",
  "Email",
  "PasswordHash",
  "CreatedAt",
  "UpdatedAt",
] as const;

export type UsersColumn = (typeof USERS_COLUMNS)[number];

export const CREATE_USERS_TABLE_SQL = `CREATE TABLE Users (
  Id TEXT NOT NULL PRIMARY KEY,
  FirstName TEXT NOT NULL,
  LastName TEXT NOT NULL,
  Username TEXT NOT NULL UNIQUE,
  Email TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL
);`;
