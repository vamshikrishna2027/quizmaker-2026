"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { readActorUserId } from "@/lib/mcq/actor";
import { MCQS_API_PATH, MCQS_PATH, mcqApiPath } from "@/lib/mcq/paths";
import { collectMcqFormIssues } from "@/lib/mcq/validation";

export type McqFormChoice = {
  text: string;
  isCorrect: boolean;
};

export type McqFormInitial = {
  name: string;
  question: string;
  choices: McqFormChoice[];
};

type ChoiceDraft = {
  key: string;
  text: string;
};

function initialChoices(initial?: McqFormInitial): ChoiceDraft[] {
  if (initial?.choices.length) {
    return initial.choices.map((choice, index) => ({
      key: String(index),
      text: choice.text,
    }));
  }
  return [
    { key: "0", text: "" },
    { key: "1", text: "" },
  ];
}

function initialCorrectKey(initial?: McqFormInitial): string | null {
  const index = initial?.choices.findIndex((choice) => choice.isCorrect) ?? -1;
  return index >= 0 ? String(index) : null;
}

export function McqQuestionForm({
  mode,
  mcqId,
  initial,
}: {
  mode: "create" | "edit";
  mcqId?: string;
  initial?: McqFormInitial;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [choices, setChoices] = useState<ChoiceDraft[]>(() =>
    initialChoices(initial),
  );
  const [correctKey, setCorrectKey] = useState<string | null>(() =>
    initialCorrectKey(initial),
  );
  const [dialogMessages, setDialogMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  function addChoice() {
    setChoices((current) => [
      ...current,
      { key: String(Date.now()), text: "" },
    ]);
  }

  function removeChoice(key: string) {
    setChoices((current) => {
      if (current.length <= 2) {
        return current;
      }
      return current.filter((choice) => choice.key !== key);
    });
    setCorrectKey((current) => (current === key ? null : current));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const issues = collectMcqFormIssues({
      name,
      question,
      choiceTexts: choices.map((choice) => choice.text),
      hasCorrectChoice: correctKey !== null,
    });
    if (issues.length > 0) {
      setDialogMessages(issues);
      return;
    }

    setIsSaving(true);
    const url =
      mode === "edit" && mcqId ? mcqApiPath(mcqId) : MCQS_API_PATH;
    const response = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorUserId: readActorUserId() ?? "",
        name,
        question,
        choices: choices.map((choice) => ({
          text: choice.text,
          isCorrect: choice.key === correctKey,
        })),
      }),
    });
    setIsSaving(false);

    if (response.ok) {
      window.location.assign(MCQS_PATH);
      return;
    }

    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setDialogMessages([data?.error ?? "Unable to save question."]);
  }

  return (
    <div className="flex min-h-svh w-full flex-col gap-6 p-6 md:p-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-medium">
          {mode === "edit" ? "Edit question" : "Create question"}
        </h1>
        <Link href={MCQS_PATH} className={buttonVariants({ variant: "outline" })}>
          Back to questions
        </Link>
      </header>

      <form className="max-w-2xl" onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="mcq-name">Name</FieldLabel>
            <Input
              id="mcq-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="mcq-question">Question</FieldLabel>
            <Input
              id="mcq-question"
              name="question"
              value={question}
              onChange={(event) => setQuestion(event.currentTarget.value)}
            />
          </Field>
          <RadioGroup
            value={correctKey ?? ""}
            onValueChange={(value) => setCorrectKey(String(value))}
          >
            {choices.map((choice, index) => (
              <div key={choice.key} className="flex items-center gap-2">
                <RadioGroupItem
                  value={choice.key}
                  aria-label={`Correct answer for choice ${index + 1}`}
                />
                <Input
                  aria-label={`Choice ${index + 1}`}
                  value={choice.text}
                  onChange={(event) => {
                    const text = event.currentTarget.value;
                    setChoices((current) =>
                      current.map((item) =>
                        item.key === choice.key ? { ...item, text } : item,
                      ),
                    );
                  }}
                />
                {choices.length > 2 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeChoice(choice.key)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </RadioGroup>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addChoice}>
              Add choice
            </Button>
            <Button type="submit" disabled={isSaving}>
              Save
            </Button>
          </div>
        </FieldGroup>
      </form>

      <Dialog
        open={dialogMessages.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMessages([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot save</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {dialogMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setDialogMessages([])}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
