import { describe, expect, it, vi } from "vitest";
import { submitAuthRequest } from "./submit-auth";

describe("submitAuthRequest", () => {
  it("follows redirect responses by assigning window.location", async () => {
    const assign = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 303,
      headers: {
        get: (name: string) => (name === "Location" ? "/mcq" : null),
      },
    }));
    vi.stubGlobal("window", { location: { assign } });

    const result = await submitAuthRequest("/register", {
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada",
      email: "ada@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ ok: true });
    expect(assign).toHaveBeenCalledWith("/mcq");
  });

  it("follows opaqueredirect responses by assigning the MCQ stub", async () => {
    const assign = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        type: "opaqueredirect",
        status: 0,
        headers: { get: () => null },
      }),
    );
    vi.stubGlobal("window", { location: { assign } });

    const result = await submitAuthRequest("/login", {
      usernameOrEmail: "ada@example.com",
      password: "SecurePass123!",
    });

    expect(result).toEqual({ ok: true });
    expect(assign).toHaveBeenCalledWith("/mcq");
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
