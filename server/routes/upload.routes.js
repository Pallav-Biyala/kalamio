import { Router } from 'express';
import express from 'express';
import { verifyJWT } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { getUploadUrl } from '../controllers/upload.controller.js';

const router = Router();

// Allow larger body for upload metadata, rate-limited to 10/min
router.get("/get-upload-url", verifyJWT, uploadLimiter, getUploadUrl);

export default router;
