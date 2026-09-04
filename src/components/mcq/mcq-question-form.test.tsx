import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqQuestionForm } from "@/components/mcq/mcq-question-form";
import { ACTOR_STORAGE_KEY } from "@/lib/mcq/actor";
import { MCQS_API_PATH, MCQS_PATH } from "@/lib/mcq/paths";
import {
  EMPTY_TEXT_BOX_MESSAGE,
  NO_CORRECT_ANSWER_MESSAGE,
} from "@/lib/mcq/validation";

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

const assign = vi.fn();

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name$/i), "Photosynthesis");
  await user.type(
    screen.getByLabelText(/^question$/i),
    "What gas do plants release?",
  );
  await user.type(screen.getByLabelText(/^choice 1$/i), "Oxygen");
  await user.type(screen.getByLabelText(/^choice 2$/i), "Nitrogen");
}

describe("McqQuestionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(ACTOR_STORAGE_KEY, "user-1");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: "mcq-1" }),
      }),
    );
  });

  it("starts with two choices and no Remove; Add choice reveals Remove on every row", async () => {
    const user = userEvent.setup();
    render(<McqQuestionForm mode="create" />);

    expect(screen.getByLabelText(/^choice 1$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^choice 2$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^choice 3$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remove$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add choice/i }));

    expect(screen.getByLabelText(/^choice 3$/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^remove$/i })).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[2]);
    expect(screen.queryByLabelText(/^choice 3$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^remove$/i })).not.toBeInTheDocument();
  });

  it("shows text box is empty and does not POST", async () => {
    const user = userEvent.setup();
    render(<McqQuestionForm mode="create" />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(EMPTY_TEXT_BOX_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(NO_CORRECT_ANSWER_MESSAGE)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^ok$/i }));
    expect(screen.queryByText(EMPTY_TEXT_BOX_MESSAGE)).not.toBeInTheDocument();
  });

  it("shows none of answer is selected when texts are filled but no radio is checked", async () => {
    const user = userEvent.setup();
    render(<McqQuestionForm mode="create" />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(NO_CORRECT_ANSWER_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_TEXT_BOX_MESSAGE)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs a valid create and navigates to /mcqs", async () => {
    const user = userEvent.setup();
    render(<McqQuestionForm mode="create" />);

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText(/correct answer for choice 1/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        MCQS_API_PATH,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            actorUserId: "user-1",
            name: "Photosynthesis",
            question: "What gas do plants release?",
            choices: [
              { text: "Oxygen", isCorrect: true },
              { text: "Nitrogen", isCorrect: false },
            ],
          }),
        }),
      );
    });
    expect(assign).toHaveBeenCalledWith(MCQS_PATH);
  });

  it("surfaces uniqueness errors from 409 in the dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: "question name already exists",
          field: "name",
        }),
      }),
    );
    const user = userEvent.setup();
    render(<McqQuestionForm mode="create" />);

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText(/correct answer for choice 1/i));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      await screen.findByText("question name already exists"),
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("prefills edit fields and PUTs to the existing question", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "mcq-1" }),
      }),
    );

    render(
      <McqQuestionForm
        mode="edit"
        mcqId="mcq-1"
        initial={{
          name: "Photosynthesis",
          question: "What gas do plants release?",
          choices: [
            { text: "Oxygen", isCorrect: true },
            { text: "Nitrogen", isCorrect: false },
          ],
        }}
      />,
    );

    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Photosynthesis");
    expect(screen.getByLabelText(/^question$/i)).toHaveValue(
      "What gas do plants release?",
    );
    expect(screen.getByLabelText(/^choice 1$/i)).toHaveValue("Oxygen");
    expect(screen.getByLabelText(/^choice 2$/i)).toHaveValue("Nitrogen");

    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "Plant gas");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `${MCQS_API_PATH}/mcq-1`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            actorUserId: "user-1",
            name: "Plant gas",
            question: "What gas do plants release?",
            choices: [
              { text: "Oxygen", isCorrect: true },
              { text: "Nitrogen", isCorrect: false },
            ],
          }),
        }),
      );
    });
    expect(assign).toHaveBeenCalledWith(MCQS_PATH);
  });
});
