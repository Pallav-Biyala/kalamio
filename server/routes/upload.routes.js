import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import { uploadLimiter, apiLimiter } from '../middleware/rateLimiter.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { getUploadUrl, proxyImage } from '../controllers/upload.controller.js';

const router = Router();

// Rate-limited to 10/min
router.get("/get-upload-url", verifyJWT, uploadLimiter, asyncHandler(getUploadUrl));

// Public (images are public; <img crossOrigin> can't send an auth header) — SSRF-guarded to
// our own bucket, rate-limited. Serves the cropper so it can read pixels for crop/rotate.
router.get("/image-proxy", apiLimiter, asyncHandler(proxyImage));

export default router;
