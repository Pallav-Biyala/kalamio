import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { prerender } from '../controllers/prerender.controller.js';

const router = Router();

// Public (no auth): nginx proxies social-crawler requests for /blog/:id,
// /user/:username, /publication/:slug here as /api/v1/prerender/<path>.
router.get('/prerender/*', asyncHandler(prerender));

export default router;
