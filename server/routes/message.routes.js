import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
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
router.post("/message/send", verifyJWT, sendMessage);
router.post("/conversations", verifyJWT, getConversations);
router.post("/conversations-count", verifyJWT, getConversationsCount);
router.post("/messages", verifyJWT, getMessages);
router.post("/messages/mark-read", verifyJWT, markRead);
router.post("/messages/unread-total", verifyJWT, getUnreadTotal);
router.post("/message-request/accept", verifyJWT, acceptMessageRequest);
router.post("/message-request/decline", verifyJWT, declineMessageRequest);
router.post("/message-request/count", verifyJWT, getRequestCount);
router.post("/conversation/find", verifyJWT, findConversation);

export default router;
