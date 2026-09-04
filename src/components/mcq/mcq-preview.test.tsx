import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqPreview } from "@/components/mcq/mcq-preview";
import { ACTOR_STORAGE_KEY } from "@/lib/mcq/actor";
import { MCQS_PATH, mcqAttemptsApiPath } from "@/lib/mcq/paths";
import { ANSWER_NOT_SELECTED_MESSAGE } from "@/lib/mcq/validation";

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

const previewMcq = {
  id: "mcq-1",
  name: "Photosynthesis",
  question: "What gas do plants release?",
  choices: [
    { id: "c1", text: "Oxygen" },
    { id: "c2", text: "Nitrogen" },
  ],
};

describe("McqPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(ACTOR_STORAGE_KEY, "user-1");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows name, question, radios, Submit, and Back to questions", () => {
    render(<McqPreview mcq={previewMcq} />);

    expect(screen.getByText("Photosynthesis")).toBeInTheDocument();
    expect(screen.getByText("What gas do plants release?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /oxygen/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /nitrogen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to questions/i }),
    ).toHaveAttribute("href", MCQS_PATH);
    expect(screen.queryByText(/isCorrect/i)).not.toBeInTheDocument();
  });

  it("shows answer not selected and does not POST when no radio is chosen", async () => {
    const user = userEvent.setup();
    render(<McqPreview mcq={previewMcq} />);

    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(screen.getByText(ANSWER_NOT_SELECTED_MESSAGE)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs the selected choice and shows correct or incorrect from the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "a1",
          mcqId: "mcq-1",
          choiceId: "c1",
          isCorrect: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: "a2",
          mcqId: "mcq-1",
          choiceId: "c2",
          isCorrect: false,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<McqPreview mcq={previewMcq} />);

    await user.click(screen.getByRole("radio", { name: /oxygen/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        mcqAttemptsApiPath("mcq-1"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            actorUserId: "user-1",
            choiceId: "c1",
          }),
        }),
      );
    });
    expect(await screen.findByText(/^correct$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /nitrogen/i }));
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith(
        mcqAttemptsApiPath("mcq-1"),
        expect.objectContaining({
          body: JSON.stringify({
            actorUserId: "user-1",
            choiceId: "c2",
          }),
        }),
      );
    });
    expect(await screen.findByText(/^incorrect$/i)).toBeInTheDocument();
  });
});
