import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    getNotificationPreferences,
    updateNotificationPreferences
} from '../controllers/settings.controller.js';

const router = Router();

// Protected — all settings routes require authentication
router.post("/settings/notification-preferences", verifyJWT, asyncHandler(getNotificationPreferences));
router.post("/settings/update-notification-preferences", verifyJWT, asyncHandler(updateNotificationPreferences));

export default router;
