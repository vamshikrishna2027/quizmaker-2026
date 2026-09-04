import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

function readJson(relativePath: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

describe("Phase 5 acceptance boundaries", () => {
  it("does not add cookie, JWT, or session libraries as project dependencies", () => {
    const pkg = readJson("package.json");
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];

    expect(names).not.toContain("jsonwebtoken");
    expect(names).not.toContain("jose");
    expect(names).not.toContain("next-auth");
    expect(names).not.toContain("iron-session");
    expect(names).not.toContain("cookie");
  });
});
