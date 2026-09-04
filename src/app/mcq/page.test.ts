import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCQS_PATH } from "@/lib/auth/paths";

const redirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
}));

import Page from "./page";

describe("/mcq page", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("redirects to /mcqs", () => {
    Page();
    expect(redirect).toHaveBeenCalledWith(MCQS_PATH);
  });
});
