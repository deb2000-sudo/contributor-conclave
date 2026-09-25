import { z } from "zod";

import { batchSchema, nameSchema, universitySchema } from "@/lib/auth/validation";

export const profileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  batch: batchSchema,
  universityName: universitySchema,
});

export const mentorUpdateSchema = profileUpdateSchema.extend({
  techStackIds: z
    .array(z.uuid({ error: "Choose a tech stack." }))
    .max(20, { error: "Choose 20 tech stacks or fewer." }),
});

export const techStackNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a tech stack name." })
  .max(40, { error: "Tech stack name must be 40 characters or fewer." });

export const mentorDecisionSchema = z.enum(["APPROVED", "REJECTED"], {
  error: "Choose approve or reject.",
});

export const accountActiveSchema = z.enum(["true", "false"], {
  error: "Choose whether the account is active.",
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type MentorUpdate = z.infer<typeof mentorUpdateSchema>;
