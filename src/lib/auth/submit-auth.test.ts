import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitAuthRequest } from "./submit-auth";

const ACTOR_STORAGE_KEY = "quizmaker.actorUserId";

describe("submitAuthRequest", () => {
  const assign = vi.fn();
  const storage = new Map<string, string>();

  beforeEach(() => {
    assign.mockReset();
    storage.clear();
    vi.stubGlobal("window", { location: { assign } });
    vi.stubGlobal("sessionStorage", {
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  it("stores the actor id and navigates to /mcqs on 200 JSON success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ userId: "user-1", redirectTo: "/mcqs" }),
      }),
    );

    const result = await submitAuthRequest("/register", {
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada",
      email: "ada@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ ok: true });
    expect(storage.get(ACTOR_STORAGE_KEY)).toBe("user-1");
    expect(assign).toHaveBeenCalledWith("/mcqs");
  });

  it("clears the actor id and follows logout redirects", async () => {
    storage.set(ACTOR_STORAGE_KEY, "user-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 303,
      headers: {
        get: (name: string) => (name === "Location" ? "/login" : null),
      },
    }));

    const result = await submitAuthRequest("/logout", {});

    expect(result).toEqual({ ok: true });
    expect(storage.has(ACTOR_STORAGE_KEY)).toBe(false);
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("follows opaqueredirect responses by assigning /mcqs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        type: "opaqueredirect",
        status: 0,
        headers: { get: () => null },
      }),
    );

    const result = await submitAuthRequest("/login", {
      usernameOrEmail: "ada@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ ok: true });
    expect(assign).toHaveBeenCalledWith("/mcqs");
  });

  it("returns server validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 409,
        ok: false,
        json: async () => ({
          error: "A user with this username already exists.",
          field: "username",
        }),
      }),
    );

    const result = await submitAuthRequest("/register", {
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada",
      email: "ada@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({
      ok: false,
      error: "A user with this username already exists.",
      field: "username",
    });
  });
});
