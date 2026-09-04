"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { McqQuestionForm, type McqFormInitial } from "@/components/mcq/mcq-question-form";
import { MCQS_PATH, mcqApiPath } from "@/lib/mcq/paths";

type EditMcqResponse = McqFormInitial & { id: string };

export function McqEditPage({ id }: { id: string }) {
  const [mcq, setMcq] = useState<EditMcqResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch(mcqApiPath(id)).then(async (response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setMcq(null);
        return;
      }
      setMcq((await response.json()) as EditMcqResponse);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (mcq === undefined) {
    return (
      <div className="flex min-h-svh w-full items-center p-6 md:p-10">
        <p>Loading question...</p>
      </div>
    );
  }

  if (mcq === null) {
    return (
      <div className="flex min-h-svh w-full flex-col gap-4 p-6 md:p-10">
        <p>Question not found.</p>
        <Link href={MCQS_PATH} className={buttonVariants({ variant: "outline" })}>
          Back to questions
        </Link>
      </div>
    );
  }

  return (
    <McqQuestionForm
      mode="edit"
      mcqId={id}
      initial={{
        name: mcq.name,
        question: mcq.question,
        choices: mcq.choices,
      }}
    />
  );
}
