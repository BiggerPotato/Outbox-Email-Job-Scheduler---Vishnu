import { z } from 'zod';

export const composeSchema = z.object({
  senderId: z.string().min(1, 'Sender is required'),
  recipients: z.array(z.string().email()).min(1, 'Add at least one recipient'),
  subject: z.string().min(3, 'Subject is required'),
  body: z.string().min(10, 'Body is required'),
  delayBetweenEmails: z.coerce.number().int().min(0, 'Delay must be 0 or more'),
  hourlyLimit: z.coerce.number().int().min(1, 'Hourly limit must be at least 1'),
  scheduledAt: z.date({ required_error: 'Schedule date is required' }),
  scheduledTime: z
    .string()
    .min(1, 'Schedule time is required')
    .regex(/^\d{2}:\d{2}$/, 'Schedule time is invalid')
});

export type ComposeFormValues = z.infer<typeof composeSchema>;
