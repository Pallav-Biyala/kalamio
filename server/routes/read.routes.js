import { Router } from "express";
import { optionalJWT } from "../middleware/auth.js";
import { recordRead } from "../controllers/read.controller.js";

const router = Router();

// POST /record-read — Track a validated read event
// Uses optionalJWT: req.user will be the user ID if logged in, null if anonymous
router.post("/record-read", optionalJWT, recordRead);

export default router;
