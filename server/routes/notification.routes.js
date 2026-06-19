import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { newNotification, getNotifications, allNotificationsCount, markAllNotificationsRead, deleteNotification } from '../controllers/notification.controller.js';

const router = Router();

// All protected
router.get("/new-notification", verifyJWT, asyncHandler(newNotification));
router.post("/notifications", verifyJWT, asyncHandler(getNotifications));
router.post("/all-notifications-count", verifyJWT, asyncHandler(allNotificationsCount));
router.post("/mark-all-notifications-read", verifyJWT, asyncHandler(markAllNotificationsRead));
router.post("/delete-notification", verifyJWT, asyncHandler(deleteNotification));

export default router;
