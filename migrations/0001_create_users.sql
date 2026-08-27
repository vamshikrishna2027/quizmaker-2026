-- Migration: create Users table for Sprint 1 authentication.
CREATE TABLE Users (
  Id TEXT NOT NULL PRIMARY KEY,
  FirstName TEXT NOT NULL,
  LastName TEXT NOT NULL,
  Username TEXT NOT NULL UNIQUE,
  Email TEXT NOT NULL UNIQUE,
  PasswordHash TEXT NOT NULL,
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL
);
