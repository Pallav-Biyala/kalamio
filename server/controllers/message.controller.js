import Conversation from '../Schema/Conversation.js';
import Message from '../Schema/Message.js';
import Connection from '../Schema/Connection.js';
import User from '../Schema/User.js';
import BlockedUser from '../Schema/BlockedUser.js';
import sanitizeHtml from 'sanitize-html';

/**
 * Helper: check if two users are connected (accepted connection).
 */
const areConnected = async (userId1, userId2) => {
    const conn = await Connection.findOne({
        $or: [
            { requester: userId1, recipient: userId2, status: 'accepted' },
            { requester: userId2, recipient: userId1, status: 'accepted' }
        ]
    });
    return !!conn;
};

/**
 * Helper: find or create conversation between two users.
 */
const findOrCreateConversation = async (senderId, recipientId) => {
    // Check for existing conversation in either direction
    let conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId] },
        $expr: { $eq: [{ $size: "$participants" }, 2] }
    });

    if (conversation) return conversation;

    // Check connection status to determine type
    const connected = await areConnected(senderId, recipientId);

    conversation = await new Conversation({
        participants: [senderId, recipientId],
        type: connected ? 'dm' : 'request',
        request_status: connected ? null : 'pending',
        unread_counts: new Map([[senderId.toString(), 0], [recipientId.toString(), 0]])
    }).save();

    return conversation;
};

// ────────────────────────────────────────────────────────
// SEND MESSAGE
// ────────────────────────────────────────────────────────

/**
 * POST /api/message/send
 * Send a message. Auto-creates conversation if needed.
 * Connected users → DM. Non-connected → Message Request.
 */
export const sendMessage = async (req, res) => {
    try {
        const sender_id = req.user;
        const { recipient_id, content, conversation_id } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ error: "Message content is required" });
        }

        if (content.length > 5000) {
            return res.status(400).json({ error: "Message too long (max 5000 characters)" });
        }

        let conversation;

        if (conversation_id) {
            // Sending within existing conversation
            conversation = await Conversation.findOne({
                _id: conversation_id,
                participants: sender_id
            });

            if (!conversation) {
                return res.status(404).json({ error: "Conversation not found" });
            }

            // Don't allow sending in a declined request
            if (conversation.request_status === 'declined') {
                return res.status(403).json({ error: "This message request was declined" });
            }

            // Don't allow sending if it's a pending request and the sender is the requester
            // (only the requester's first message is allowed, they can't spam)
            if (conversation.request_status === 'pending' && conversation.type === 'request') {
                const existingMessages = await Message.countDocuments({
                    conversation: conversation_id,
                    sender: sender_id
                });
                // Requester already sent the initial message, can't send more until accepted
                if (existingMessages > 0 && conversation.participants[0].toString() === sender_id) {
                    return res.status(403).json({ error: "Waiting for the recipient to accept your request" });
                }
            }
        } else if (recipient_id) {
            // New conversation or find existing
            if (sender_id === recipient_id) {
                return res.status(400).json({ error: "Cannot message yourself" });
            }

            const targetUser = await User.findById(recipient_id).select("_id privacy_settings");
            if (!targetUser) {
                return res.status(404).json({ error: "User not found" });
            }

            // Block check — either direction
            const blocked = await BlockedUser.findOne({
                $or: [
                    { blocker: sender_id, blocked: recipient_id },
                    { blocker: recipient_id, blocked: sender_id }
                ]
            });
            if (blocked) {
                return res.status(403).json({ error: "Cannot message this user" });
            }

            // Privacy check — respect recipient's who_can_message setting
            const msgPref = targetUser.privacy_settings?.who_can_message || 'everyone';
            if (msgPref === 'nobody') {
                return res.status(403).json({ error: "This user is not accepting messages" });
            }
            if (msgPref === 'connections') {
                const connected = await areConnected(sender_id, recipient_id);
                if (!connected) {
                    return res.status(403).json({ error: "This user only accepts messages from connections" });
                }
            }

            conversation = await findOrCreateConversation(sender_id, recipient_id);
        } else {
            return res.status(400).json({ error: "Recipient or conversation ID required" });
        }

        // Sanitize message content — strip all HTML to prevent XSS
        const sanitizedContent = sanitizeHtml(content.trim(), { allowedTags: [], allowedAttributes: {} });

        if (!sanitizedContent.length) {
            return res.status(400).json({ error: "Message content is required" });
        }

        // Create the message
        const message = await new Message({
            conversation: conversation._id,
            sender: sender_id,
            content: sanitizedContent
        }).save();

        // Update conversation's last_message and unread count
        const recipientId = conversation.participants
            .find(p => p.toString() !== sender_id)
            .toString();

        conversation.last_message = {
            content: sanitizedContent.substring(0, 100),
            sender: sender_id,
            timestamp: message.sentAt
        };

        // Increment unread count for recipient
        const currentUnread = conversation.unread_counts.get(recipientId) || 0;
        conversation.unread_counts.set(recipientId, currentUnread + 1);

        await conversation.save();

        // Populate sender info for the response
        const populatedMessage = await Message.findById(message._id)
            .populate("sender", "personal_info.fullname personal_info.username personal_info.profile_img");

        // Emit via Socket.IO if available
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${recipientId}`).emit('new_message', {
                message: populatedMessage,
                conversation_id: conversation._id
            });
        }

        return res.status(200).json({
            message: populatedMessage,
            conversation_id: conversation._id,
            conversation_type: conversation.type,
            request_status: conversation.request_status
        });

    } catch (err) {
        console.error('[Message] sendMessage failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// CONVERSATIONS
// ────────────────────────────────────────────────────────

/**
 * POST /api/conversations
 * Get paginated list of conversations for the logged-in user.
 * filter: 'all' | 'dms' | 'requests'
 */
export const getConversations = async (req, res) => {
    try {
        const user_id = req.user;
        const { page = 1, filter = 'all' } = req.body;
        const maxLimit = 20;

        let query = { participants: user_id };

        if (filter === 'dms') {
            query.$or = [
                { type: 'dm' },
                { type: 'request', request_status: 'accepted' }
            ];
        } else if (filter === 'requests') {
            query.type = 'request';
            query.request_status = 'pending';
        }

        const conversations = await Conversation.find(query)
            .populate("participants", "personal_info.fullname personal_info.username personal_info.profile_img")
            .sort({ "last_message.timestamp": -1 })
            .skip((page - 1) * maxLimit)
            .limit(maxLimit);

        // Add 'other' user info for convenience
        const results = conversations.map(conv => {
            const convObj = conv.toObject();
            convObj.other_user = convObj.participants.find(
                p => p._id.toString() !== user_id
            );
            convObj.unread = conv.unread_counts.get(user_id) || 0;
            return convObj;
        });

        return res.status(200).json({ conversations: results });

    } catch (err) {
        console.error('[Message] getConversations failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/conversations-count
 * Count conversations.
 */
export const getConversationsCount = async (req, res) => {
    try {
        const user_id = req.user;
        const { filter = 'all' } = req.body;

        let query = { participants: user_id };

        if (filter === 'dms') {
            query.$or = [
                { type: 'dm' },
                { type: 'request', request_status: 'accepted' }
            ];
        } else if (filter === 'requests') {
            query.type = 'request';
            query.request_status = 'pending';
        }

        const count = await Conversation.countDocuments(query);
        return res.status(200).json({ totalDocs: count });

    } catch (err) {
        console.error('[Message] getConversationsCount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// MESSAGES
// ────────────────────────────────────────────────────────

/**
 * POST /api/messages
 * Get paginated messages for a conversation.
 */
export const getMessages = async (req, res) => {
    try {
        const user_id = req.user;
        const { conversation_id, page = 1 } = req.body;
        const maxLimit = 30;

        if (!conversation_id) {
            return res.status(400).json({ error: "Conversation ID required" });
        }

        // Verify user is a participant
        const conversation = await Conversation.findOne({
            _id: conversation_id,
            participants: user_id
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const messages = await Message.find({ conversation: conversation_id })
            .populate("sender", "personal_info.fullname personal_info.username personal_info.profile_img")
            .sort({ sentAt: -1 })
            .skip((page - 1) * maxLimit)
            .limit(maxLimit);

        const totalDocs = await Message.countDocuments({ conversation: conversation_id });

        return res.status(200).json({
            messages: messages.reverse(), // Return in chronological order
            totalDocs,
            conversation
        });

    } catch (err) {
        console.error('[Message] getMessages failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/messages/mark-read
 * Mark all messages in a conversation as read for the current user.
 */
export const markRead = async (req, res) => {
    try {
        const user_id = req.user;
        const { conversation_id } = req.body;

        if (!conversation_id) {
            return res.status(400).json({ error: "Conversation ID required" });
        }

        // Mark all messages from the other user as read
        await Message.updateMany(
            { conversation: conversation_id, sender: { $ne: user_id }, read: false },
            { $set: { read: true } }
        );

        // Reset unread count for this user
        await Conversation.findByIdAndUpdate(conversation_id, {
            $set: { [`unread_counts.${user_id}`]: 0 }
        });

        // Notify sender their messages were read via Socket.IO
        const io = req.app.get('io');
        if (io) {
            const conv = await Conversation.findById(conversation_id);
            if (conv) {
                const otherId = conv.participants.find(p => p.toString() !== user_id)?.toString();
                if (otherId) {
                    io.to(`user:${otherId}`).emit('messages_read', {
                        conversation_id,
                        reader: user_id
                    });
                }
            }
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('[Message] markRead failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/messages/unread-total
 * Get total unread message count across all conversations.
 */
export const getUnreadTotal = async (req, res) => {
    try {
        const user_id = req.user;

        const conversations = await Conversation.find({ participants: user_id });
        let total = 0;
        for (const conv of conversations) {
            total += conv.unread_counts.get(user_id) || 0;
        }

        return res.status(200).json({ unread_total: total });

    } catch (err) {
        console.error('[Message] getUnreadTotal failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// MESSAGE REQUESTS
// ────────────────────────────────────────────────────────

/**
 * POST /api/message-request/accept
 * Accept a message request (promotes conversation to DM).
 */
export const acceptMessageRequest = async (req, res) => {
    try {
        const user_id = req.user;
        const { conversation_id } = req.body;

        if (!conversation_id) {
            return res.status(400).json({ error: "Conversation ID required" });
        }

        const conversation = await Conversation.findOne({
            _id: conversation_id,
            participants: user_id,
            type: 'request',
            request_status: 'pending'
        });

        if (!conversation) {
            return res.status(404).json({ error: "No pending request found" });
        }

        conversation.request_status = 'accepted';
        await conversation.save();

        return res.status(200).json({ status: 'accepted' });

    } catch (err) {
        console.error('[Message] acceptMessageRequest failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/message-request/decline
 * Decline a message request.
 */
export const declineMessageRequest = async (req, res) => {
    try {
        const user_id = req.user;
        const { conversation_id } = req.body;

        if (!conversation_id) {
            return res.status(400).json({ error: "Conversation ID required" });
        }

        const conversation = await Conversation.findOne({
            _id: conversation_id,
            participants: user_id,
            type: 'request',
            request_status: 'pending'
        });

        if (!conversation) {
            return res.status(404).json({ error: "No pending request found" });
        }

        conversation.request_status = 'declined';
        await conversation.save();

        return res.status(200).json({ status: 'declined' });

    } catch (err) {
        console.error('[Message] declineMessageRequest failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/message-request/count
 * Count pending message requests.
 */
export const getRequestCount = async (req, res) => {
    try {
        const user_id = req.user;

        // Get requests where I'm the recipient (not the initiator)
        const conversations = await Conversation.find({
            participants: user_id,
            type: 'request',
            request_status: 'pending'
        });

        // The first message's sender is the initiator — count only where I'm NOT the initiator
        let count = 0;
        for (const conv of conversations) {
            if (conv.last_message?.sender?.toString() !== user_id) {
                count++;
            }
        }

        return res.status(200).json({ totalDocs: count });

    } catch (err) {
        console.error('[Message] getRequestCount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/conversation/find
 * Find an existing conversation with a specific user (for starting chat from profile).
 */
export const findConversation = async (req, res) => {
    try {
        const user_id = req.user;
        const { other_user_id } = req.body;

        if (!other_user_id) {
            return res.status(400).json({ error: "Other user ID required" });
        }

        const conversation = await Conversation.findOne({
            participants: { $all: [user_id, other_user_id] },
            $expr: { $eq: [{ $size: "$participants" }, 2] }
        })
        .populate("participants", "personal_info.fullname personal_info.username personal_info.profile_img");

        if (!conversation) {
            return res.status(200).json({ conversation: null });
        }

        const convObj = conversation.toObject();
        convObj.other_user = convObj.participants.find(p => p._id.toString() !== user_id);
        convObj.unread = conversation.unread_counts.get(user_id) || 0;

        return res.status(200).json({ conversation: convObj });

    } catch (err) {
        console.error('[Message] findConversation failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
