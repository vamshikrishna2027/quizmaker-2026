"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LOGIN_PATH, REGISTER_PATH } from "@/lib/auth/paths";
import { registerSchema } from "@/lib/auth/schemas";
import { submitAuthRequest } from "@/lib/auth/submit-auth";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    const result = await submitAuthRequest(REGISTER_PATH, parsed.data);
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.field) {
        setFieldErrors({ [result.field]: result.error });
      } else {
        setFormError(result.error);
      }
    }
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your teacher account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {formError ? <FieldError>{formError}</FieldError> : null}
            <Field data-invalid={Boolean(fieldErrors.firstName)}>
              <FieldLabel htmlFor="firstName">First name</FieldLabel>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
              />
              <FieldError>{fieldErrors.firstName}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldErrors.lastName)}>
              <FieldLabel htmlFor="lastName">Last name</FieldLabel>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
              />
              <FieldError>{fieldErrors.lastName}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldErrors.username)}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
              />
              <FieldError>{fieldErrors.username}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldErrors.email)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="teacher@example.com"
                autoComplete="email"
                required
              />
              <FieldDescription>
                You can use a different username, or make username the same as
                email.
              </FieldDescription>
              <FieldError>{fieldErrors.email}</FieldError>
            </Field>
            <Field data-invalid={Boolean(fieldErrors.password)}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldError>{fieldErrors.password}</FieldError>
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
              <FieldDescription className="text-center">
                Already have an account?{" "}
                <Link href={LOGIN_PATH} className="underline underline-offset-4">
                  Sign in
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
