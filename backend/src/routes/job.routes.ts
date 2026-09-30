import { Router } from "express";

import { cancelScheduledJob, getScheduledJobs, getSentJobs } from "../controllers/job.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validator";
import { GetJobsQuerySchema } from "../types/job.types";

/**
 * Job routes.
 */
const router = Router();

/**
 * Job routes for scheduled and sent emails.
 */
router.get(
  "/jobs/scheduled",
  requireAuth,
  validateRequest({ query: GetJobsQuerySchema }),
  getScheduledJobs
);

router.get(
  "/jobs/sent",
  requireAuth,
  validateRequest({ query: GetJobsQuerySchema }),
  getSentJobs
);

router.delete("/jobs/:id", requireAuth, cancelScheduledJob);

export { router as jobRouter };
