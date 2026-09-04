import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "@/components/signup-form";
import { LoginForm } from "@/components/login-form";
import { LOGIN_PATH, REGISTER_PATH } from "@/lib/auth/paths";

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

describe("SignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows required-field validation when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(submitAuthRequest).not.toHaveBeenCalled();
  });

  it("submits to POST /register and redirects to the MCQ stub on success", async () => {
    submitAuthRequest.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/^username$/i), "ada");
    await user.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(submitAuthRequest).toHaveBeenCalledWith(REGISTER_PATH, {
        firstName: "Ada",
        lastName: "Lovelace",
        username: "ada",
        email: "ada@example.com",
        password: "SecurePass123!",
      });
    });
  });

  it("shows duplicate username error from the server", async () => {
    submitAuthRequest.mockResolvedValue({
      ok: false,
      error: "A user with this username already exists.",
      field: "username",
    });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/first name/i), "Ada");
    await user.type(screen.getByLabelText(/last name/i), "Lovelace");
    await user.type(screen.getByLabelText(/^username$/i), "ada");
    await user.type(screen.getByLabelText(/^email$/i), "ada@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/username already exists/i),
    ).toBeInTheDocument();
  });
});

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows required-field validation when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(
      await screen.findByText(/username or email is required/i),
    ).toBeInTheDocument();
    expect(submitAuthRequest).not.toHaveBeenCalled();
  });

  it("submits to POST /login and redirects on success", async () => {
    submitAuthRequest.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(
      screen.getByLabelText(/username or email/i),
      "ada@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(submitAuthRequest).toHaveBeenCalledWith(LOGIN_PATH, {
        usernameOrEmail: "ada@example.com",
        password: "SecurePass123!",
      });
    });
  });

  it("shows invalid credentials error from the server", async () => {
    submitAuthRequest.mockResolvedValue({
      ok: false,
      error: "Invalid username/email or password.",
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/username or email/i), "ada");
    await user.type(screen.getByLabelText(/^password$/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^login$/i }));

    expect(
      await screen.findByText(/invalid username\/email or password/i),
    ).toBeInTheDocument();
  });
});

