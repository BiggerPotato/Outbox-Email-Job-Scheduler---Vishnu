import { Router } from "express";
import multer from "multer";

import { validateCsv } from "../controllers/csv.controller";
import { requireAuth } from "../middleware/auth.middleware";

/**
 * CSV validation routes.
 */
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/csv/validate", requireAuth, upload.single("file"), validateCsv);

export { router as csvRouter };
