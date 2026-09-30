import { z } from 'zod';

export const campaignSchema = z.object({
  subject: z.string().min(3, 'Subject is required'),
  body: z.string().min(10, 'Email body is required'),
  senderId: z.string().min(1, 'Sender is required'),
  startDate: z.date({ required_error: 'Start date is required' }),
  startTime: z.string().min(1, 'Start time is required'),
  delayBetweenEmails: z.coerce.number().int().min(0, 'Delay must be 0 or more'),
  hourlyLimit: z.coerce.number().int().min(1, 'Hourly limit must be at least 1'),
  recipients: z.array(z.string().email()).min(1, 'Upload at least one email')
});

export type CampaignFormValues = z.infer<typeof campaignSchema>;
