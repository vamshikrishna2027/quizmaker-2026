import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { McqEditPage } from "@/components/mcq/mcq-edit-page";
import { MCQS_PATH, mcqApiPath } from "@/lib/mcq/paths";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("McqEditPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows not-found and a back link when the question is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "MCQ not found." }),
      }),
    );

    render(<McqEditPage id="missing" />);

    expect(await screen.findByText(/question not found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to questions/i }),
    ).toHaveAttribute("href", MCQS_PATH);
    expect(fetch).toHaveBeenCalledWith(mcqApiPath("missing"));
  });

  it("prefills the form when GET /api/mcqs/:id succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "mcq-1",
          name: "Photosynthesis",
          question: "What gas do plants release?",
          choices: [
            { text: "Oxygen", isCorrect: true },
            { text: "Nitrogen", isCorrect: false },
          ],
        }),
      }),
    );

    render(<McqEditPage id="mcq-1" />);

    expect(await screen.findByLabelText(/^name$/i)).toHaveValue("Photosynthesis");
    expect(screen.getByLabelText(/^question$/i)).toHaveValue(
      "What gas do plants release?",
    );
  });
});
