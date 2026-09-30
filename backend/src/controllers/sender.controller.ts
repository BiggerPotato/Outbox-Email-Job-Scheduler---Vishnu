import { Response, NextFunction } from "express";

import { prisma } from "../config/database";
import { RequestWithUser } from "../types/common.types";
import { ValidationError, NotFoundError, ForbiddenError, AuthError } from "../utils/errors";
import { logger } from "../utils/logger";

const getUserId = (req: RequestWithUser): string => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new AuthError("Missing authentication token", "AUTH_MISSING");
  }
  return userId;
};

/**
 * Creates a new sender for the authenticated user.
 */
const createSender = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { email, displayName } = req.body as { email: string; displayName: string };

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.sender.findFirst({
      where: { userId, email: normalizedEmail }
    });

    if (existing) {
      throw new ValidationError("Sender email already exists", "SENDER_EXISTS");
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: normalizedEmail,
        displayName: displayName.trim()
      }
    });

    logger.info({ userId, senderId: sender.id }, "Sender created");
    res.status(201).json({ success: true, data: sender });
  } catch (error) {
    logger.error({ error }, "Create sender failed");
    next(error);
  }
};

/**
 * Lists senders for the authenticated user.
 */
const getSenders = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ success: true, data: senders });
  } catch (error) {
    logger.error({ error }, "Get senders failed");
    next(error);
  }
};

/**
 * Deletes a sender if no active campaigns exist.
 */
const deleteSender = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const senderId = req.params.id;

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      throw new NotFoundError("Sender not found", "SENDER_NOT_FOUND");
    }
    if (sender.userId !== userId) {
      throw new ForbiddenError("Sender does not belong to user", "SENDER_FORBIDDEN");
    }

    const activeCampaigns = await prisma.emailCampaign.count({
      where: {
        senderId,
        status: { in: ["SCHEDULED", "RUNNING", "PAUSED"] }
      }
    });

    if (activeCampaigns > 0) {
      throw new ValidationError(
        "Sender has active campaigns and cannot be deleted",
        "SENDER_HAS_ACTIVE_CAMPAIGNS"
      );
    }

    await prisma.sender.delete({ where: { id: senderId } });
    logger.info({ userId, senderId }, "Sender deleted");
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error({ error }, "Delete sender failed");
    next(error);
  }
};

export { createSender, getSenders, deleteSender };
