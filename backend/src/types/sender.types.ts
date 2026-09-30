import { z } from "zod";

export type CreateSenderDTO = {
  email: string;
  displayName: string;
};

export const CreateSenderSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100)
});
