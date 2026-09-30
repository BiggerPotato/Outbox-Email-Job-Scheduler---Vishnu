export interface Campaign {
  id: string;
  subject: string;
  body: string;
  senderId: string;
  scheduledStartAt: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  totalRecipients?: number;
  createdAt?: string;
}
