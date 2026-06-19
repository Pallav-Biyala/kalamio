import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { blockUser, unblockUser, getBlockedUsers, getBlockedUsersCount, isBlocked } from '../controllers/block.controller.js';

const router = Router();

router.post('/block-user', verifyJWT, asyncHandler(blockUser));
router.post('/unblock-user', verifyJWT, asyncHandler(unblockUser));
router.post('/blocked-users', verifyJWT, asyncHandler(getBlockedUsers));
router.post('/blocked-users-count', verifyJWT, asyncHandler(getBlockedUsersCount));
router.post('/is-blocked', verifyJWT, asyncHandler(isBlocked));

export default router;
