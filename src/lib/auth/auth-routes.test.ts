import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const createUser = vi.fn();
const getUserByUsernameOrEmail = vi.fn();
const getPasswordHashForUsernameOrEmail = vi.fn();
const verifyPassword = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getDb: () => getDb(),
}));

vi.mock("@/lib/services/user-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/user-service")
  >("@/lib/services/user-service");
  return {
    ...actual,
    createUser: (...args: unknown[]) => createUser(...args),
    getUserByUsernameOrEmail: (...args: unknown[]) =>
      getUserByUsernameOrEmail(...args),
    getPasswordHashForUsernameOrEmail: (...args: unknown[]) =>
      getPasswordHashForUsernameOrEmail(...args),
  };
});

vi.mock("@/lib/password", () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
  hashPassword: vi.fn(),
}));

import { POST as registerPost } from "@/app/api/register/route";
import { POST as loginPost } from "@/app/api/login/route";
import { POST as logoutPost } from "@/app/api/logout/route";
import { UserConflictError } from "@/lib/services/user-service";

const mockDb = {} as D1Database;

const sampleUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  username: "ada",
  email: "ada@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await registerPost(
      jsonRequest("http://localhost/register", {
        firstName: "Ada",
        username: "ada",
        email: "ada@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/lastName|required|invalid/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when username is already registered", async () => {
    createUser.mockRejectedValue(new UserConflictError("username"));

    const response = await registerPost(
      jsonRequest("http://localhost/register", {
        firstName: "Ada",
        lastName: "Lovelace",
        username: "ada",
        email: "ada@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/username/i);
  });

  it("returns 409 when email is already registered", async () => {
    createUser.mockRejectedValue(new UserConflictError("email"));

    const response = await registerPost(
      jsonRequest("http://localhost/register", {
        firstName: "Ada",
        lastName: "Lovelace",
        username: "ada",
        email: "ada@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/email/i);
  });

  it("creates a user via User Service and redirects to the MCQ stub", async () => {
    createUser.mockResolvedValue(sampleUser);

    const response = await registerPost(
      jsonRequest("http://localhost/register", {
        firstName: "Ada",
        lastName: "Lovelace",
        username: "ada",
        email: "ada@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(createUser).toHaveBeenCalledWith(mockDb, {
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada",
      email: "ada@example.com",
      password: "SecurePass123!",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/mcq");
  });
});

describe("POST /login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await loginPost(
      jsonRequest("http://localhost/login", {
        password: "SecurePass123!",
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/usernameOrEmail|required|invalid/i);
    expect(getUserByUsernameOrEmail).not.toHaveBeenCalled();
  });

  it("returns 401 for invalid credentials", async () => {
    getUserByUsernameOrEmail.mockResolvedValue(sampleUser);
    getPasswordHashForUsernameOrEmail.mockResolvedValue("stored-hash");
    verifyPassword.mockResolvedValue(false);

    const response = await loginPost(
      jsonRequest("http://localhost/login", {
        usernameOrEmail: "ada",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 401 when the user does not exist", async () => {
    getUserByUsernameOrEmail.mockResolvedValue(null);
    getPasswordHashForUsernameOrEmail.mockResolvedValue(null);

    const response = await loginPost(
      jsonRequest("http://localhost/login", {
        usernameOrEmail: "missing",
        password: "SecurePass123!",
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("verifies the password hash and redirects to the MCQ stub on success", async () => {
    getUserByUsernameOrEmail.mockResolvedValue(sampleUser);
    getPasswordHashForUsernameOrEmail.mockResolvedValue("stored-hash");
    verifyPassword.mockResolvedValue(true);

    const response = await loginPost(
      jsonRequest("http://localhost/login", {
        usernameOrEmail: "ada@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(getPasswordHashForUsernameOrEmail).toHaveBeenCalledWith(
      mockDb,
      "ada@example.com",
    );
    expect(verifyPassword).toHaveBeenCalledWith(
      "SecurePass123!",
      "stored-hash",
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/mcq");
  });
});

describe("POST /logout", () => {
  it("accepts POST and redirects to login without using cookies or tokens", async () => {
    const response = await logoutPost(
      new Request("http://localhost/logout", { method: "POST" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
