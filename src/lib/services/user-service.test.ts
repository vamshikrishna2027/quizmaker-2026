import { beforeEach, describe, expect, it } from "vitest";
import {
  createUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserByUsernameOrEmail,
  updateUser,
  UserConflictError,
  UserNotFoundError,
  type CreateUserInput,
} from "./user-service";
import { verifyPassword } from "@/lib/password";

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

function createMemoryDb() {
  const rows: UserRow[] = [];

  const db = {
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();

      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              if (/^INSERT INTO Users/i.test(normalized)) {
                const [
                  Id,
                  FirstName,
                  LastName,
                  Username,
                  Email,
                  PasswordHash,
                  CreatedAt,
                  UpdatedAt,
                ] = params as string[];

                if (rows.some((row) => row.Username === Username)) {
                  throw new Error("UNIQUE constraint failed: Users.Username");
                }
                if (rows.some((row) => row.Email === Email)) {
                  throw new Error("UNIQUE constraint failed: Users.Email");
                }

                rows.push({
                  Id,
                  FirstName,
                  LastName,
                  Username,
                  Email,
                  PasswordHash,
                  CreatedAt,
                  UpdatedAt,
                });
                return { success: true, meta: { changes: 1 } };
              }

              if (/^UPDATE Users SET/i.test(normalized)) {
                const id = params[params.length - 1] as string;
                const index = rows.findIndex((row) => row.Id === id);
                if (index === -1) {
                  return { success: true, meta: { changes: 0 } };
                }

                const current = rows[index];
                // UPDATE Users SET FirstName=?1, LastName=?2, Username=?3, Email=?4, PasswordHash=?5, UpdatedAt=?6 WHERE Id=?7
                const [
                  FirstName,
                  LastName,
                  Username,
                  Email,
                  PasswordHash,
                  UpdatedAt,
                ] = params as string[];

                if (
                  rows.some(
                    (row) => row.Username === Username && row.Id !== id,
                  )
                ) {
                  throw new Error("UNIQUE constraint failed: Users.Username");
                }
                if (
                  rows.some((row) => row.Email === Email && row.Id !== id)
                ) {
                  throw new Error("UNIQUE constraint failed: Users.Email");
                }

                rows[index] = {
                  ...current,
                  FirstName,
                  LastName,
                  Username,
                  Email,
                  PasswordHash,
                  UpdatedAt,
                };
                return { success: true, meta: { changes: 1 } };
              }

              if (/^DELETE FROM Users WHERE Id = \?1/i.test(normalized)) {
                const id = params[0] as string;
                const before = rows.length;
                const next = rows.filter((row) => row.Id !== id);
                rows.length = 0;
                rows.push(...next);
                return {
                  success: true,
                  meta: { changes: before === rows.length ? 0 : 1 },
                };
              }

              throw new Error(`Unsupported run SQL in memory db: ${normalized}`);
            },
            async all() {
              let results: UserRow[] = [];

              if (
                /WHERE Username = \?1 OR Email = \?2/i.test(normalized)
              ) {
                results = rows.filter(
                  (row) =>
                    row.Username === params[0] || row.Email === params[1],
                );
              } else if (/WHERE Id = \?1/i.test(normalized)) {
                results = rows.filter((row) => row.Id === params[0]);
              } else if (/WHERE Username = \?1/i.test(normalized)) {
                results = rows.filter((row) => row.Username === params[0]);
              } else if (/WHERE Email = \?1/i.test(normalized)) {
                results = rows.filter((row) => row.Email === params[0]);
              } else {
                throw new Error(
                  `Unsupported all SQL in memory db: ${normalized}`,
                );
              }

              return { results };
            },
          };
        },
      };
    },
    __rows: rows,
  };

  return db as unknown as D1Database & { __rows: UserRow[] };
}

const baseInput: CreateUserInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  username: "ada",
  email: "ada@example.com",
  password: "SecurePass123!",
};

describe("userService", () => {
  let db: D1Database & { __rows: UserRow[] };

  beforeEach(() => {
    db = createMemoryDb();
  });

  it("creates a user and returns the persisted record without a password", async () => {
    const user = await createUser(db, baseInput);

    expect(user.id).toBeTruthy();
    expect(user.firstName).toBe("Ada");
    expect(user.lastName).toBe("Lovelace");
    expect(user.username).toBe("ada");
    expect(user.email).toBe("ada@example.com");
    expect(user.createdAt).toBeTruthy();
    expect(user.updatedAt).toBeTruthy();
    expect(user).not.toHaveProperty("password");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("stores a password hash instead of plain text", async () => {
    const user = await createUser(db, baseInput);
    const stored = db.__rows.find((row) => row.Id === user.id);

    expect(stored).toBeDefined();
    expect(stored!.PasswordHash).not.toBe(baseInput.password);
    expect(stored!.PasswordHash.includes(baseInput.password)).toBe(false);
    await expect(
      verifyPassword(baseInput.password, stored!.PasswordHash),
    ).resolves.toBe(true);
  });

  it("rejects duplicate username registrations", async () => {
    await createUser(db, baseInput);

    await expect(
      createUser(db, {
        ...baseInput,
        email: "other@example.com",
      }),
    ).rejects.toBeInstanceOf(UserConflictError);

    await expect(
      createUser(db, {
        ...baseInput,
        email: "other@example.com",
      }),
    ).rejects.toThrow(/username/i);
  });

  it("rejects duplicate email registrations", async () => {
    await createUser(db, baseInput);

    await expect(
      createUser(db, {
        ...baseInput,
        username: "other-ada",
      }),
    ).rejects.toBeInstanceOf(UserConflictError);

    await expect(
      createUser(db, {
        ...baseInput,
        username: "other-ada",
      }),
    ).rejects.toThrow(/email/i);
  });

  it("reads a user by id, username, and email", async () => {
    const created = await createUser(db, baseInput);

    await expect(getUserById(db, created.id)).resolves.toEqual(created);
    await expect(getUserByUsername(db, "ada")).resolves.toEqual(created);
    await expect(getUserByEmail(db, "ada@example.com")).resolves.toEqual(
      created,
    );
  });

  it("finds a user by username or email for login lookups", async () => {
    const created = await createUser(db, baseInput);

    await expect(
      getUserByUsernameOrEmail(db, "ada"),
    ).resolves.toMatchObject({ id: created.id, username: "ada" });
    await expect(
      getUserByUsernameOrEmail(db, "ada@example.com"),
    ).resolves.toMatchObject({ id: created.id, email: "ada@example.com" });
  });

  it("returns null when a user is missing", async () => {
    await expect(getUserById(db, "missing")).resolves.toBeNull();
    await expect(getUserByUsername(db, "missing")).resolves.toBeNull();
    await expect(getUserByEmail(db, "missing@example.com")).resolves.toBeNull();
    await expect(
      getUserByUsernameOrEmail(db, "missing"),
    ).resolves.toBeNull();
  });

  it("updates mutable user fields and UpdatedAt", async () => {
    const created = await createUser(db, baseInput);
    const updated = await updateUser(db, created.id, {
      firstName: "Augusta",
      lastName: "King",
      username: "augusta",
      email: "augusta@example.com",
    });

    expect(updated.firstName).toBe("Augusta");
    expect(updated.lastName).toBe("King");
    expect(updated.username).toBe("augusta");
    expect(updated.email).toBe("augusta@example.com");
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("hashes a new password when update includes password", async () => {
    const created = await createUser(db, baseInput);
    await updateUser(db, created.id, { password: "NewSecurePass456!" });

    const stored = db.__rows.find((row) => row.Id === created.id);
    expect(stored).toBeDefined();
    expect(stored!.PasswordHash).not.toBe("NewSecurePass456!");
    await expect(
      verifyPassword("NewSecurePass456!", stored!.PasswordHash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword(baseInput.password, stored!.PasswordHash),
    ).resolves.toBe(false);
  });

  it("throws when updating a missing user", async () => {
    await expect(
      updateUser(db, "missing", { firstName: "Nope" }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it("deletes a user by id", async () => {
    const created = await createUser(db, baseInput);
    await deleteUser(db, created.id);

    await expect(getUserById(db, created.id)).resolves.toBeNull();
    expect(db.__rows).toHaveLength(0);
  });

  it("throws when deleting a missing user", async () => {
    await expect(deleteUser(db, "missing")).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it("allows multiple teachers to register independently", async () => {
    const first = await createUser(db, baseInput);
    const second = await createUser(db, {
      firstName: "Grace",
      lastName: "Hopper",
      username: "grace",
      email: "grace@example.com",
      password: "AnotherPass456!",
    });

    expect(first.id).not.toBe(second.id);
    expect(db.__rows).toHaveLength(2);
    await expect(getUserByUsername(db, "ada")).resolves.toMatchObject({
      id: first.id,
    });
    await expect(getUserByUsername(db, "grace")).resolves.toMatchObject({
      id: second.id,
    });
  });
});
