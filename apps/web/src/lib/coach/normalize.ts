import { z } from "zod";
import type { CoachResponse } from "./types";

const MistakeSchema = z.object({
  moveNumber: z.number().int().positive(),
  played: z.string().max(20),
  better: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().slice(0, 48) : val),
    z.string().max(48),
  ),
  explanation: z.string().max(300),
});

export const CoachResponseSchema = z.object({
  kind: z.literal("full"),
  summary: z.string().max(500),
  mistakes: z.array(MistakeSchema).transform((arr) => arr.slice(0, 10)),
  lessons: z.array(z.string().max(200)).transform((arr) => arr.slice(0, 5)),
  praise: z.array(z.string().max(200)).transform((arr) => arr.slice(0, 3)),
});

type NormalizeResult =
  | { success: true; data: CoachResponse }
  | { success: false; error: string };

export function normalizeCoachResponse(raw: unknown): NormalizeResult {
  try {
    const parsed = CoachResponseSchema.parse(raw);
    return { success: true, data: parsed };
  } catch (err) {
    const message = err instanceof z.ZodError
      ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
      : "Invalid response format";
    return { success: false, error: message };
  }
}
