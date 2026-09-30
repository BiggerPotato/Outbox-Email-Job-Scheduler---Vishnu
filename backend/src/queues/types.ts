export interface EmailJobData {
  emailJobId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderId: string;
}

export enum QueueNames {
  EMAIL_QUEUE = "email-sending"
}
