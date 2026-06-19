import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { getAnalyticsOverview, getTopPosts, getFollowerGrowth } from '../controllers/analytics.controller.js';

const router = Router();

router.post('/analytics/overview', verifyJWT, asyncHandler(getAnalyticsOverview));
router.post('/analytics/top-posts', verifyJWT, asyncHandler(getTopPosts));
router.post('/analytics/follower-growth', verifyJWT, asyncHandler(getFollowerGrowth));

export default router;
