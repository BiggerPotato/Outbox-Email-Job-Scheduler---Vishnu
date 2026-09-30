import { Router } from "express";

import {
  createCampaign,
  getCampaignById,
  getCampaigns,
  getCampaignTimeline
} from "../controllers/campaign.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validator";
import { CreateCampaignSchema, GetCampaignsQuerySchema } from "../types/campaign.types";

/**
 * Campaign routes.
 */
const router = Router();

router.post(
  "/campaigns",
  requireAuth,
  validateRequest({ body: CreateCampaignSchema }),
  createCampaign
);

router.get(
  "/campaigns",
  requireAuth,
  validateRequest({ query: GetCampaignsQuerySchema }),
  getCampaigns
);

router.get("/campaigns/:id", requireAuth, getCampaignById);
router.get("/campaigns/:id/timeline", requireAuth, getCampaignTimeline);

export { router as campaignRouter };
