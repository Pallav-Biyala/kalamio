import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    followUser,
    unfollowUser,
    isFollowing,
    isFollowingBack,
    getFollowers,
    getFollowersCount,
    getFollowing,
    getFollowingCount,
    followFeed,
    followFeedCount
} from '../controllers/follow.controller.js';

const router = Router();

// Public — anyone can view followers/following lists
router.post("/followers", asyncHandler(getFollowers));
router.post("/followers-count", asyncHandler(getFollowersCount));
router.post("/following", asyncHandler(getFollowing));
router.post("/following-count", asyncHandler(getFollowingCount));

// Protected — requires authentication
router.post("/follow", verifyJWT, asyncHandler(followUser));
router.post("/unfollow", verifyJWT, asyncHandler(unfollowUser));
router.post("/is-following", verifyJWT, asyncHandler(isFollowing));
router.post("/is-following-back", verifyJWT, asyncHandler(isFollowingBack));
router.post("/follow-feed", verifyJWT, asyncHandler(followFeed));
router.post("/follow-feed-count", verifyJWT, asyncHandler(followFeedCount));

export default router;
