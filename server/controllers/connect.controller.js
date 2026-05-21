import Connection from '../Schema/Connection.js';
import User from '../Schema/User.js';
import Notification from '../Schema/Notification.js';

/**
 * POST /api/connect/send
 * Send a connection request. Both people must agree (like LinkedIn).
 */
export const sendConnectRequest = async (req, res) => {
    try {
        const requester_id = req.user;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        if (requester_id === user_id) {
            return res.status(400).json({ error: "You cannot connect with yourself" });
        }

        // Verify target user exists
        const targetUser = await User.findById(user_id).select("_id");
        if (!targetUser) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if a connection already exists in either direction
        const existing = await Connection.findOne({
            $or: [
                { requester: requester_id, recipient: user_id },
                { requester: user_id, recipient: requester_id }
            ]
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(200).json({ status: 'accepted', message: "Already connected" });
            }
            if (existing.status === 'pending') {
                // If the other person already sent us a request, auto-accept
                if (existing.requester.toString() === user_id) {
                    existing.status = 'accepted';
                    existing.acceptedAt = new Date();
                    await existing.save();

                    // Update both users' connection counts
                    await Promise.all([
                        User.findByIdAndUpdate(requester_id, { $inc: { "account_info.total_connections": 1 } }),
                        User.findByIdAndUpdate(user_id, { $inc: { "account_info.total_connections": 1 } })
                    ]);

                    // Notify both
                    new Notification({
                        type: "connect_accepted",
                        notification_for: user_id,
                        user: requester_id,
                    }).save().catch(err => console.error('[Connect] Notification error:', err.message));

                    return res.status(200).json({ status: 'accepted', message: "Connection accepted (mutual request)" });
                }
                return res.status(200).json({ status: 'pending', message: "Request already sent" });
            }
            if (existing.status === 'declined') {
                // Allow re-requesting after decline
                existing.status = 'pending';
                existing.requester = requester_id;
                existing.recipient = user_id;
                existing.acceptedAt = null;
                await existing.save();

                new Notification({
                    type: "connect_request",
                    notification_for: user_id,
                    user: requester_id,
                }).save().catch(err => console.error('[Connect] Notification error:', err.message));

                return res.status(200).json({ status: 'pending' });
            }
        }

        // Create new connection request
        await new Connection({ requester: requester_id, recipient: user_id }).save();

        // Notify recipient
        new Notification({
            type: "connect_request",
            notification_for: user_id,
            user: requester_id,
        }).save().catch(err => console.error('[Connect] Notification error:', err.message));

        return res.status(200).json({ status: 'pending' });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(200).json({ status: 'pending', message: "Request already sent" });
        }
        console.error('[Connect] sendConnectRequest failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/accept
 * Accept a pending connection request.
 */
export const acceptConnection = async (req, res) => {
    try {
        const recipient_id = req.user;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const connection = await Connection.findOne({
            requester: user_id,
            recipient: recipient_id,
            status: 'pending'
        });

        if (!connection) {
            return res.status(404).json({ error: "No pending request found" });
        }

        connection.status = 'accepted';
        connection.acceptedAt = new Date();
        await connection.save();

        // Update both users' connection counts
        await Promise.all([
            User.findByIdAndUpdate(recipient_id, { $inc: { "account_info.total_connections": 1 } }),
            User.findByIdAndUpdate(user_id, { $inc: { "account_info.total_connections": 1 } })
        ]);

        // Notify the requester that their request was accepted
        new Notification({
            type: "connect_accepted",
            notification_for: user_id,
            user: recipient_id,
        }).save().catch(err => console.error('[Connect] Notification error:', err.message));

        return res.status(200).json({ status: 'accepted' });

    } catch (err) {
        console.error('[Connect] acceptConnection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/decline
 * Decline a pending connection request.
 */
export const declineConnection = async (req, res) => {
    try {
        const recipient_id = req.user;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const connection = await Connection.findOne({
            requester: user_id,
            recipient: recipient_id,
            status: 'pending'
        });

        if (!connection) {
            return res.status(404).json({ error: "No pending request found" });
        }

        connection.status = 'declined';
        await connection.save();

        // Clean up the connect_request notification
        Notification.findOneAndDelete({ type: "connect_request", notification_for: recipient_id, user: user_id })
            .catch(err => console.error('[Connect] Notification cleanup error:', err.message));

        return res.status(200).json({ status: 'declined' });

    } catch (err) {
        console.error('[Connect] declineConnection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/withdraw
 * Withdraw a sent connection request (by the requester).
 */
export const withdrawConnection = async (req, res) => {
    try {
        const requester_id = req.user;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const result = await Connection.findOneAndDelete({
            requester: requester_id,
            recipient: user_id,
            status: 'pending'
        });

        if (!result) {
            return res.status(404).json({ error: "No pending request to withdraw" });
        }

        // Clean up notification
        Notification.findOneAndDelete({ type: "connect_request", notification_for: user_id, user: requester_id })
            .catch(err => console.error('[Connect] Notification cleanup error:', err.message));

        return res.status(200).json({ status: 'none' });

    } catch (err) {
        console.error('[Connect] withdrawConnection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/remove
 * Remove an existing connection (either party can disconnect).
 */
export const removeConnection = async (req, res) => {
    try {
        const current_user = req.user;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const result = await Connection.findOneAndDelete({
            $or: [
                { requester: current_user, recipient: user_id, status: 'accepted' },
                { requester: user_id, recipient: current_user, status: 'accepted' }
            ]
        });

        if (!result) {
            return res.status(200).json({ status: 'none' });
        }

        // Decrement connection counts
        await Promise.all([
            User.findByIdAndUpdate(current_user, { $inc: { "account_info.total_connections": -1 } }),
            User.findByIdAndUpdate(user_id, { $inc: { "account_info.total_connections": -1 } })
        ]);

        return res.status(200).json({ status: 'none' });

    } catch (err) {
        console.error('[Connect] removeConnection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/status
 * Get the connection status between logged-in user and another user.
 * Returns: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'
 */
export const connectionStatus = async (req, res) => {
    try {
        const current_user = req.user;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const connection = await Connection.findOne({
            $or: [
                { requester: current_user, recipient: user_id },
                { requester: user_id, recipient: current_user }
            ]
        });

        if (!connection) {
            return res.status(200).json({ status: 'none' });
        }

        if (connection.status === 'accepted') {
            return res.status(200).json({ status: 'accepted', acceptedAt: connection.acceptedAt });
        }

        if (connection.status === 'pending') {
            const direction = connection.requester.toString() === current_user
                ? 'pending_sent'
                : 'pending_received';
            return res.status(200).json({ status: direction });
        }

        // Declined — treat as none for the UI
        return res.status(200).json({ status: 'none' });

    } catch (err) {
        console.error('[Connect] connectionStatus failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connections
 * Get paginated list of accepted connections.
 */
export const getConnections = async (req, res) => {
    try {
        const user_id = req.user;
        const { page = 1 } = req.body;
        const maxLimit = 15;

        const connections = await Connection.find({
            $or: [
                { requester: user_id, status: 'accepted' },
                { recipient: user_id, status: 'accepted' }
            ]
        })
        .populate("requester", "personal_info.fullname personal_info.username personal_info.profile_img")
        .populate("recipient", "personal_info.fullname personal_info.username personal_info.profile_img")
        .sort({ acceptedAt: -1 })
        .skip((page - 1) * maxLimit)
        .limit(maxLimit);

        // Return the OTHER person (not self) for each connection
        const results = connections.map(conn => {
            const other = conn.requester._id.toString() === user_id
                ? conn.recipient
                : conn.requester;
            return {
                ...other.toObject(),
                acceptedAt: conn.acceptedAt,
                connectionId: conn._id
            };
        });

        return res.status(200).json({ users: results });

    } catch (err) {
        console.error('[Connect] getConnections failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connections-count
 * Count accepted connections.
 */
export const getConnectionsCount = async (req, res) => {
    try {
        const user_id = req.user;

        const count = await Connection.countDocuments({
            $or: [
                { requester: user_id, status: 'accepted' },
                { recipient: user_id, status: 'accepted' }
            ]
        });

        return res.status(200).json({ totalDocs: count });

    } catch (err) {
        console.error('[Connect] getConnectionsCount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/pending
 * Get paginated list of pending connection requests received.
 */
export const getPendingRequests = async (req, res) => {
    try {
        const user_id = req.user;
        const { page = 1 } = req.body;
        const maxLimit = 15;

        const requests = await Connection.find({
            recipient: user_id,
            status: 'pending'
        })
        .populate("requester", "personal_info.fullname personal_info.username personal_info.profile_img personal_info.bio")
        .sort({ requestedAt: -1 })
        .skip((page - 1) * maxLimit)
        .limit(maxLimit);

        const results = requests.map(req => ({
            ...req.requester.toObject(),
            requestedAt: req.requestedAt,
            connectionId: req._id
        }));

        return res.status(200).json({ users: results });

    } catch (err) {
        console.error('[Connect] getPendingRequests failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/connect/pending-count
 * Count pending connection requests received.
 */
export const getPendingCount = async (req, res) => {
    try {
        const user_id = req.user;

        const count = await Connection.countDocuments({
            recipient: user_id,
            status: 'pending'
        });

        return res.status(200).json({ totalDocs: count });

    } catch (err) {
        console.error('[Connect] getPendingCount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
