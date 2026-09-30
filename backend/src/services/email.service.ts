import nodemailer, { Transporter } from "nodemailer";

import { env } from "../config/env";
import { prisma } from "../config/database";
import { logger } from "../utils/logger";

/**
 * Service for sending emails through Ethereal SMTP and updating job status.
 */
class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }

  /**
   * Send an email and update the corresponding EmailJob status.
   */
  async sendEmail(
    jobId: string,
    recipientEmail: string,
    subject: string,
    body: string,
    senderEmail: string
  ): Promise<void> {
    const context = { jobId, recipientEmail };
    const info = await this.transporter.sendMail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info({ ...context, messageId: info.messageId, previewUrl }, "Email sent");

    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null
      }
    });
  }
}

export { EmailService };
