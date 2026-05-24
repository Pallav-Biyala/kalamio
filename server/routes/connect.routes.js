import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    sendConnectRequest,
    acceptConnection,
    declineConnection,
    withdrawConnection,
    removeConnection,
    connectionStatus,
    getConnections,
    getConnectionsCount,
    getPendingRequests,
    getPendingCount,
    getSentRequests,
    getSentCount
} from '../controllers/connect.controller.js';

const router = Router();

// All connect endpoints require authentication
router.post("/connect/send", verifyJWT, asyncHandler(sendConnectRequest));
router.post("/connect/accept", verifyJWT, asyncHandler(acceptConnection));
router.post("/connect/decline", verifyJWT, asyncHandler(declineConnection));
router.post("/connect/withdraw", verifyJWT, asyncHandler(withdrawConnection));
router.post("/connect/remove", verifyJWT, asyncHandler(removeConnection));
router.post("/connect/status", verifyJWT, asyncHandler(connectionStatus));
router.post("/connections", verifyJWT, asyncHandler(getConnections));
router.post("/connections-count", verifyJWT, asyncHandler(getConnectionsCount));
router.post("/connect/pending", verifyJWT, asyncHandler(getPendingRequests));
router.post("/connect/pending-count", verifyJWT, asyncHandler(getPendingCount));
router.post("/connect/sent", verifyJWT, asyncHandler(getSentRequests));
router.post("/connect/sent-count", verifyJWT, asyncHandler(getSentCount));

export default router;
