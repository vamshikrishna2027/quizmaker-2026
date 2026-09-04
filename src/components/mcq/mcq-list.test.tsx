import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McqList } from "@/components/mcq/mcq-list";
import { LOGOUT_PATH, MCQS_PATH } from "@/lib/auth/paths";
import { ACTOR_STORAGE_KEY } from "@/lib/mcq/actor";
import { MCQS_API_PATH, MCQS_NEW_PATH, mcqEditPath, mcqPreviewPath } from "@/lib/mcq/paths";

const submitAuthRequest = vi.fn();

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

vi.mock("@/lib/auth/submit-auth", () => ({
  submitAuthRequest: (...args: unknown[]) => submitAuthRequest(...args),
}));

const sampleMcqs = [
  {
    id: "mcq-1",
    name: "Photosynthesis",
    question: "What gas do plants release?",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mcq-2",
    name: "Gravity",
    question: "What pulls objects toward Earth?",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function mockListResponse(mcqs: typeof sampleMcqs = sampleMcqs) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mcqs }),
    }),
  );
}

describe("McqList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem(ACTOR_STORAGE_KEY, "user-1");
    mockListResponse();
  });

  it("shows Name, Question, Actions headers plus Create question and Log out", async () => {
    render(<McqList />);

    expect(
      await screen.findByRole("columnheader", { name: /^name$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^question$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^actions$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create question/i }),
    ).toHaveAttribute("href", MCQS_NEW_PATH);
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("renders rows and opens Edit, Preview, and Delete from the 3-dot menu", async () => {
    const user = userEvent.setup();
    render(<McqList />);

    expect(await screen.findByText("Photosynthesis")).toBeInTheDocument();
    expect(screen.getByText("What gas do plants release?")).toBeInTheDocument();

    const actions = screen.getAllByRole("button", { name: /^actions$/i });
    await user.click(actions[0]);

    const edit = await screen.findByRole("menuitem", { name: /^edit$/i });
    const preview = screen.getByRole("menuitem", { name: /^preview$/i });
    expect(edit).toHaveAttribute("href", mcqEditPath("mcq-1"));
    expect(preview).toHaveAttribute("href", mcqPreviewPath("mcq-1"));
    expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("asks for confirmation and deletes only on confirm", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ mcqs: sampleMcqs }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<McqList />);
    expect(await screen.findByText("Photosynthesis")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^actions$/i })[0]);
    await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
    await user.click(await screen.findByRole("button", { name: /^cancel$/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Photosynthesis")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^actions$/i })[0]);
    await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${MCQS_API_PATH}/mcq-1`,
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ actorUserId: "user-1" }),
        }),
      );
    });
    expect(screen.queryByText("Photosynthesis")).not.toBeInTheDocument();
    expect(screen.getByText("Gravity")).toBeInTheDocument();
  });

  it("keeps Create question available when the bank is empty", async () => {
    mockListResponse([]);
    render(<McqList />);

    expect(
      await screen.findByRole("link", { name: /create question/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Photosynthesis")).not.toBeInTheDocument();
  });

  it("clears the actor id by posting logout", async () => {
    const user = userEvent.setup();
    render(<McqList />);
    await screen.findByRole("button", { name: /log out/i });
    await user.click(screen.getByRole("button", { name: /log out/i }));

    expect(submitAuthRequest).toHaveBeenCalledWith(LOGOUT_PATH, {});
    expect(screen.queryByText(MCQS_PATH)).not.toBeInTheDocument();
  });
});
