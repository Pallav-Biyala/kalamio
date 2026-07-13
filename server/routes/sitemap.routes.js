import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { sitemap } from '../controllers/sitemap.controller.js';

const router = Router();

// Public (no auth). Reached at /api/v1/sitemap.xml; nginx proxies the public
// /sitemap.xml here (the URL robots.txt advertises).
router.get('/sitemap.xml', asyncHandler(sitemap));

export default router;
