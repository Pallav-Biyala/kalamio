import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
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
    getPendingCount
} from '../controllers/connect.controller.js';

const router = Router();

// All connect endpoints require authentication
router.post("/connect/send", verifyJWT, sendConnectRequest);
router.post("/connect/accept", verifyJWT, acceptConnection);
router.post("/connect/decline", verifyJWT, declineConnection);
router.post("/connect/withdraw", verifyJWT, withdrawConnection);
router.post("/connect/remove", verifyJWT, removeConnection);
router.post("/connect/status", verifyJWT, connectionStatus);
router.post("/connections", verifyJWT, getConnections);
router.post("/connections-count", verifyJWT, getConnectionsCount);
router.post("/connect/pending", verifyJWT, getPendingRequests);
router.post("/connect/pending-count", verifyJWT, getPendingCount);

export default router;
