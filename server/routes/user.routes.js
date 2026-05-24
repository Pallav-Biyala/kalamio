import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { searchUsers, getProfile, updateProfileImg, updateProfile } from '../controllers/user.controller.js';

const router = Router();

// Public
router.post("/search-users", asyncHandler(searchUsers));
router.post("/get-profile", asyncHandler(getProfile));

// Protected
router.post("/update-profile-img", verifyJWT, asyncHandler(updateProfileImg));
router.post("/update-profile", verifyJWT, asyncHandler(updateProfile));

export default router;
