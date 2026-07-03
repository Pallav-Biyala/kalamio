import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/schemas.js';
import { searchUsers, getProfile, getUserById, updateProfileImg, updateProfile, searchConnectionsFollows } from '../controllers/user.controller.js';

const router = Router();

// Public
router.post("/search-users", asyncHandler(searchUsers));
router.post("/get-profile", asyncHandler(getProfile));
router.post("/get-user-by-id", asyncHandler(getUserById));

// Protected
router.post("/update-profile-img", verifyJWT, asyncHandler(updateProfileImg));
router.post("/update-profile", verifyJWT, validate(updateProfileSchema), asyncHandler(updateProfile));
router.post("/search-connections-follows", verifyJWT, asyncHandler(searchConnectionsFollows));

export default router;
