"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { McqPreview, type PreviewMcq } from "@/components/mcq/mcq-preview";
import { MCQS_PATH, mcqPreviewApiPath } from "@/lib/mcq/paths";

export function McqPreviewPage({ id }: { id: string }) {
  const [mcq, setMcq] = useState<PreviewMcq | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetch(mcqPreviewApiPath(id)).then(async (response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setMcq(null);
        return;
      }
      setMcq((await response.json()) as PreviewMcq);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (mcq === undefined) {
    return (
      <div className="flex min-h-svh w-full items-center p-6 md:p-10">
        <p>Loading preview...</p>
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

  return <McqPreview mcq={mcq} />;
}
