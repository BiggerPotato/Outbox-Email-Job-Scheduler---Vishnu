import { Router } from "express";

import { createSender, deleteSender, getSenders } from "../controllers/sender.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validator";
import { CreateSenderSchema } from "../types/sender.types";

/**
 * Sender routes.
 */
const router = Router();

router.post("/senders", requireAuth, validateRequest({ body: CreateSenderSchema }), createSender);
router.get("/senders", requireAuth, getSenders);
router.delete("/senders/:id", requireAuth, deleteSender);

export { router as senderRouter };
