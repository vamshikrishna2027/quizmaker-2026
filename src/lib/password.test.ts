import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes a password so the plain text is not returned", async () => {
    const plain = "TeacherPass123!";
    const hashed = await hashPassword(plain);

    expect(hashed).not.toBe(plain);
    expect(hashed.includes(plain)).toBe(false);
  });

  it("verifies the correct password against its hash", async () => {
    const plain = "TeacherPass123!";
    const hashed = await hashPassword(plain);

    await expect(verifyPassword(plain, hashed)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hashed = await hashPassword("TeacherPass123!");

    await expect(verifyPassword("wrong-password", hashed)).resolves.toBe(false);
  });

  it("produces different hashes for the same password (unique salt)", async () => {
    const plain = "TeacherPass123!";
    const first = await hashPassword(plain);
    const second = await hashPassword(plain);

    expect(first).not.toBe(second);
    await expect(verifyPassword(plain, first)).resolves.toBe(true);
    await expect(verifyPassword(plain, second)).resolves.toBe(true);
  });
});
