import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    getNotificationPreferences, updateNotificationPreferences,
    getPrivacySettings, updatePrivacySettings,
    deactivateAccount, reactivateAccount, deleteAccount, getAccountStatus,
    exportData
} from '../controllers/settings.controller.js';

const router = Router();

// Notification preferences
router.post('/settings/notification-preferences', verifyJWT, asyncHandler(getNotificationPreferences));
router.post('/settings/update-notification-preferences', verifyJWT, asyncHandler(updateNotificationPreferences));

// Privacy settings
router.post('/settings/privacy', verifyJWT, asyncHandler(getPrivacySettings));
router.post('/settings/update-privacy', verifyJWT, asyncHandler(updatePrivacySettings));

// Account management
router.post('/settings/account-status', verifyJWT, asyncHandler(getAccountStatus));
router.post('/settings/deactivate-account', verifyJWT, asyncHandler(deactivateAccount));
router.post('/settings/reactivate-account', verifyJWT, asyncHandler(reactivateAccount));
router.post('/settings/delete-account', verifyJWT, asyncHandler(deleteAccount));

// Data export
router.post('/settings/export-data', verifyJWT, asyncHandler(exportData));

export default router;
