/**
 * Emit a real-time `new_notification` event to a user's personal Socket.IO room so their
 * notification / "Activity" badge updates live (the client's socket→query-cache bridge invalidates
 * the unread-notifications query on receipt). No-op if the socket server or recipient is missing.
 *
 * `req` carries the io instance, set once on the Express app in server.js (`app.set('io', io)`).
 */
export const emitNotification = (req, recipientId, payload = {}) => {
    if (!recipientId) return;
    const io = req?.app?.get('io');
    if (io) {
        io.to(`user:${String(recipientId)}`).emit('new_notification', payload);
    }
};

/**
 * Push updated engagement counts (likes/comments) to everyone currently viewing a post, so the
 * numbers move live. `blogId` is the post's _id (clients join `blog:<_id>` after the post loads).
 */
export const emitBlogUpdate = (req, blogId, activity = {}) => {
    if (!blogId) return;
    const io = req?.app?.get('io');
    if (io) {
        io.to(`blog:${String(blogId)}`).emit('blog_updated', { blog_id: String(blogId), activity });
    }
};

export default emitNotification;
