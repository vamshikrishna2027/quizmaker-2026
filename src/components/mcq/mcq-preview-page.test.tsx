import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { McqPreviewPage } from "@/components/mcq/mcq-preview-page";
import { MCQS_PATH, mcqPreviewApiPath } from "@/lib/mcq/paths";

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

describe("McqPreviewPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows not-found and a back link when preview GET fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "MCQ not found." }),
      }),
    );

    render(<McqPreviewPage id="missing" />);

    expect(await screen.findByText(/question not found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to questions/i }),
    ).toHaveAttribute("href", MCQS_PATH);
    expect(fetch).toHaveBeenCalledWith(mcqPreviewApiPath("missing"));
  });

  it("loads preview-safe choices without isCorrect", async () => {
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
            { id: "c1", text: "Oxygen" },
            { id: "c2", text: "Nitrogen" },
          ],
        }),
      }),
    );

    render(<McqPreviewPage id="mcq-1" />);

    expect(await screen.findByText("Photosynthesis")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /oxygen/i })).toBeInTheDocument();
    expect(screen.queryByText(/isCorrect/i)).not.toBeInTheDocument();
  });
});
