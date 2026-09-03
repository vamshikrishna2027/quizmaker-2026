import { z } from "zod";

export const mcqChoiceSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
});

export const upsertMcqBodySchema = z.object({
  actorUserId: z.string().optional(),
  name: z.string(),
  question: z.string(),
  choices: z.array(mcqChoiceSchema).min(2, "At least two choices are required."),
});

export const deleteMcqBodySchema = z.object({
  actorUserId: z.string().optional(),
});

export const createAttemptBodySchema = z.object({
  actorUserId: z.string().optional(),
  choiceId: z.string().min(1, "choiceId is required."),
});

export type UpsertMcqBody = z.infer<typeof upsertMcqBodySchema>;
export type CreateAttemptBody = z.infer<typeof createAttemptBodySchema>;
