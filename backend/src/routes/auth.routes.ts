import { Router } from "express";

import { googleAuth, googleCallback, logout, getCurrentUser } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

/**
 * Authentication routes.
 */
const router = Router();

router.get("/auth/google", googleAuth);
router.post("/auth/google", googleAuth);
router.get("/auth/google/callback", googleCallback);
router.post("/auth/logout", requireAuth, logout);
router.get("/auth/me", requireAuth, getCurrentUser);

export { router as authRouter };
