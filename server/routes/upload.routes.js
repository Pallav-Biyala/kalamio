import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { getUploadUrl } from '../controllers/upload.controller.js';

const router = Router();

// Rate-limited to 10/min
router.get("/get-upload-url", verifyJWT, uploadLimiter, asyncHandler(getUploadUrl));

export default router;
