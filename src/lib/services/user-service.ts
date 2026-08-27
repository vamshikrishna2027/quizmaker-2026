import { hashPassword } from "@/lib/password";

export type UserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
};

export type UpdateUserInput = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string;
};

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

export class UserConflictError extends Error {
  readonly field: "username" | "email";

  constructor(field: "username" | "email") {
    super(
      field === "username"
        ? "A user with this username already exists."
        : "A user with this email already exists.",
    );
    this.name = "UserConflictError";
    this.field = field;
  }
}

export class UserNotFoundError extends Error {
  constructor(message = "User not found.") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.Id,
    firstName: row.FirstName,
    lastName: row.LastName,
    username: row.Username,
    email: row.Email,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function queryOne(
  db: D1Database,
  sql: string,
  ...params: string[]
): Promise<UserRow | null> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<UserRow>();
  return results[0] ?? null;
}

function isUniqueViolation(error: unknown, field: "Username" | "Email"): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    /UNIQUE constraint failed/i.test(error.message) &&
    error.message.includes(field)
  );
}

export async function createUser(
  db: D1Database,
  input: CreateUserInput,
): Promise<UserRecord> {
  const existingUsername = await getUserByUsername(db, input.username);
  if (existingUsername) {
    throw new UserConflictError("username");
  }

  const existingEmail = await getUserByEmail(db, input.email);
  if (existingEmail) {
    throw new UserConflictError("email");
  }

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const passwordHash = await hashPassword(input.password);

  try {
    await db
      .prepare(
        `INSERT INTO Users (Id, FirstName, LastName, Username, Email, PasswordHash, CreatedAt, UpdatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        id,
        input.firstName,
        input.lastName,
        input.username,
        input.email,
        passwordHash,
        timestamp,
        timestamp,
      )
      .run();
  } catch (error) {
    if (isUniqueViolation(error, "Username")) {
      throw new UserConflictError("username");
    }
    if (isUniqueViolation(error, "Email")) {
      throw new UserConflictError("email");
    }
    throw error;
  }

  const created = await getUserById(db, id);
  if (!created) {
    throw new Error("Failed to load user after create.");
  }
  return created;
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<UserRecord | null> {
  const row = await queryOne(db, "SELECT * FROM Users WHERE Id = ?1", id);
  return row ? mapUser(row) : null;
}

export async function getUserByUsername(
  db: D1Database,
  username: string,
): Promise<UserRecord | null> {
  const row = await queryOne(
    db,
    "SELECT * FROM Users WHERE Username = ?1",
    username,
  );
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<UserRecord | null> {
  const row = await queryOne(db, "SELECT * FROM Users WHERE Email = ?1", email);
  return row ? mapUser(row) : null;
}

export async function getUserByUsernameOrEmail(
  db: D1Database,
  usernameOrEmail: string,
): Promise<UserRecord | null> {
  const row = await queryOne(
    db,
    "SELECT * FROM Users WHERE Username = ?1 OR Email = ?2",
    usernameOrEmail,
    usernameOrEmail,
  );
  return row ? mapUser(row) : null;
}

/** Internal helper for login: returns the stored hash for a username or email. */
export async function getPasswordHashForUsernameOrEmail(
  db: D1Database,
  usernameOrEmail: string,
): Promise<string | null> {
  const row = await queryOne(
    db,
    "SELECT * FROM Users WHERE Username = ?1 OR Email = ?2",
    usernameOrEmail,
    usernameOrEmail,
  );
  return row?.PasswordHash ?? null;
}

export async function updateUser(
  db: D1Database,
  id: string,
  input: UpdateUserInput,
): Promise<UserRecord> {
  const existingRow = await queryOne(
    db,
    "SELECT * FROM Users WHERE Id = ?1",
    id,
  );
  if (!existingRow) {
    throw new UserNotFoundError();
  }

  const nextUsername = input.username ?? existingRow.Username;
  const nextEmail = input.email ?? existingRow.Email;

  if (nextUsername !== existingRow.Username) {
    const conflict = await getUserByUsername(db, nextUsername);
    if (conflict && conflict.id !== id) {
      throw new UserConflictError("username");
    }
  }

  if (nextEmail !== existingRow.Email) {
    const conflict = await getUserByEmail(db, nextEmail);
    if (conflict && conflict.id !== id) {
      throw new UserConflictError("email");
    }
  }

  const passwordHash = input.password
    ? await hashPassword(input.password)
    : existingRow.PasswordHash;
  const updatedAt = nowIso();

  try {
    await db
      .prepare(
        `UPDATE Users
         SET FirstName = ?1,
             LastName = ?2,
             Username = ?3,
             Email = ?4,
             PasswordHash = ?5,
             UpdatedAt = ?6
         WHERE Id = ?7`,
      )
      .bind(
        input.firstName ?? existingRow.FirstName,
        input.lastName ?? existingRow.LastName,
        nextUsername,
        nextEmail,
        passwordHash,
        updatedAt,
        id,
      )
      .run();
  } catch (error) {
    if (isUniqueViolation(error, "Username")) {
      throw new UserConflictError("username");
    }
    if (isUniqueViolation(error, "Email")) {
      throw new UserConflictError("email");
    }
    throw error;
  }

  const updated = await getUserById(db, id);
  if (!updated) {
    throw new UserNotFoundError();
  }
  return updated;
}

export async function deleteUser(db: D1Database, id: string): Promise<void> {
  const existing = await getUserById(db, id);
  if (!existing) {
    throw new UserNotFoundError();
  }

  await db.prepare("DELETE FROM Users WHERE Id = ?1").bind(id).run();
}
