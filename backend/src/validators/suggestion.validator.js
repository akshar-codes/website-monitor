import { z } from "zod";

export const createSuggestionSchema = z.object({
  category: z.enum(["feature", "improvement", "bug", "other"]),
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
});

export const replySuggestionSchema = z.object({
  reply: z.string().trim().min(3).max(3000),
});
