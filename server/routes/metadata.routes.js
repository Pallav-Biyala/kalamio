import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { cacheResponse } from '../middleware/cache.js';
import { fetchUrlMetadata } from '../controllers/metadata.controller.js';

const router = Router();

// Link-preview metadata is fetched from external URLs (slow) and keyed by URL —
// a perfect cache target. Long TTL, no invalidation (external content).
router.post('/url-metadata', cacheResponse({ ttl: 86400 }), asyncHandler(fetchUrlMetadata));

export default router;
