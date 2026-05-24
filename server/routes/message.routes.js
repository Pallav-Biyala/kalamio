import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    sendMessage,
    getConversations,
    getConversationsCount,
    getMessages,
    markRead,
    getUnreadTotal,
    acceptMessageRequest,
    declineMessageRequest,
    getRequestCount,
    findConversation
} from '../controllers/message.controller.js';

const router = Router();

// All messaging endpoints require authentication
router.post("/message/send", verifyJWT, asyncHandler(sendMessage));
router.post("/conversations", verifyJWT, asyncHandler(getConversations));
router.post("/conversations-count", verifyJWT, asyncHandler(getConversationsCount));
router.post("/messages", verifyJWT, asyncHandler(getMessages));
router.post("/messages/mark-read", verifyJWT, asyncHandler(markRead));
router.post("/messages/unread-total", verifyJWT, asyncHandler(getUnreadTotal));
router.post("/message-request/accept", verifyJWT, asyncHandler(acceptMessageRequest));
router.post("/message-request/decline", verifyJWT, asyncHandler(declineMessageRequest));
router.post("/message-request/count", verifyJWT, asyncHandler(getRequestCount));
router.post("/conversation/find", verifyJWT, asyncHandler(findConversation));

export default router;
