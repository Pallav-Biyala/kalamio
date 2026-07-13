import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import { cacheResponse, invalidateCacheOnWrite } from '../middleware/cache.js';
import { updateProfileSchema } from '../validators/schemas.js';
import { searchUsers, getProfile, getUserById, updateProfileImg, updateProfile, searchConnectionsFollows } from '../controllers/user.controller.js';

const router = Router();

// Public (cached, non-personalized). Follower counts here refresh via TTL rather
// than on every follow/unfollow, to avoid thrashing the cache.
router.post("/search-users", cacheResponse({ ttl: 120, tags: ['profiles'] }), asyncHandler(searchUsers));
router.post("/get-profile", cacheResponse({ ttl: 120, tags: ['profiles'] }), asyncHandler(getProfile));
router.post("/get-user-by-id", cacheResponse({ ttl: 120, tags: ['profiles'] }), asyncHandler(getUserById));

// Protected — editing a profile invalidates the profiles cache.
router.post("/update-profile-img", verifyJWT, invalidateCacheOnWrite(['profiles']), asyncHandler(updateProfileImg));
router.post("/update-profile", verifyJWT, validate(updateProfileSchema), invalidateCacheOnWrite(['profiles']), asyncHandler(updateProfile));
router.post("/search-connections-follows", verifyJWT, asyncHandler(searchConnectionsFollows));

export default router;
