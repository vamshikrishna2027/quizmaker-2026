"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { readActorUserId } from "@/lib/mcq/actor";
import { MCQS_PATH, mcqAttemptsApiPath } from "@/lib/mcq/paths";
import { ANSWER_NOT_SELECTED_MESSAGE } from "@/lib/mcq/validation";

export type PreviewChoice = {
  id: string;
  text: string;
};

export type PreviewMcq = {
  id: string;
  name: string;
  question: string;
  choices: PreviewChoice[];
};

export function McqPreview({ mcq }: { mcq: PreviewMcq }) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedChoiceId) {
      setFeedback(ANSWER_NOT_SELECTED_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(mcqAttemptsApiPath(mcq.id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorUserId: readActorUserId() ?? "",
        choiceId: selectedChoiceId,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      setFeedback("Unable to record attempt.");
      return;
    }

    const data = (await response.json()) as { isCorrect?: boolean };
    setFeedback(data.isCorrect ? "correct" : "incorrect");
  }

  return (
    <div className="flex min-h-svh w-full flex-col gap-6 p-6 md:p-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-medium">{mcq.name}</h1>
        <Link href={MCQS_PATH} className={buttonVariants({ variant: "outline" })}>
          Back to questions
        </Link>
      </header>

      <form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
        <p className="text-base">{mcq.question}</p>
        <RadioGroup
          value={selectedChoiceId ?? ""}
          onValueChange={(value) => setSelectedChoiceId(String(value))}
        >
          {mcq.choices.map((choice) => {
            const inputId = `preview-choice-${choice.id}`;
            return (
              <div key={choice.id} className="flex items-center gap-2">
                <RadioGroupItem
                  value={choice.id}
                  id={inputId}
                  aria-label={choice.text}
                />
                <Label htmlFor={inputId}>{choice.text}</Label>
              </div>
            );
          })}
        </RadioGroup>
        {feedback ? <p>{feedback}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          Submit
        </Button>
      </form>
    </div>
  );
}
