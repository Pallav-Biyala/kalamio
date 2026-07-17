import mongoose, { Schema } from "mongoose";

/**
 * A like — the record of "this user likes this thing".
 *
 * WHY THIS EXISTS: likes used to BE notifications (a `notification` doc with type:"like"), and
 * "is it liked?" was `Notification.exists(...)`. That conflated two unrelated concerns:
 *   - a like is durable state owned by the LIKER
 *   - a notification is a transient inbox item owned by the AUTHOR
 * So the author deleting "X liked your post" from their Activity silently destroyed X's like while
 * `activity.total_likes` kept counting it — a permanent desync no user could explain or repair.
 * Notifications are still emitted for the Activity feed; they just no longer ARE the like.
 *
 * Exactly one of `blog` / `comment` is set. The partial unique indexes below are the real
 * integrity guarantee: a user physically cannot like the same target twice, so a double-tap or two
 * racing requests can't create two rows (and thus can't double-count). That makes the like/unlike
 * handlers idempotent at the DATABASE level rather than by hopeful application-side checks.
 */
const likeSchema = mongoose.Schema({
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    blog: {
        type: Schema.Types.ObjectId,
        ref: 'blogs',
    },
    comment: {
        type: Schema.Types.ObjectId,
        ref: 'comments',
    },
}, { timestamps: true });

// One like per user per post / per comment. Partial so a post-like (no `comment` field) and a
// comment-like (no `blog` field) don't collide on a shared null.
likeSchema.index(
    { user: 1, blog: 1 },
    { unique: true, partialFilterExpression: { blog: { $type: 'objectId' } } },
);
likeSchema.index(
    { user: 1, comment: 1 },
    { unique: true, partialFilterExpression: { comment: { $type: 'objectId' } } },
);

// "Who liked this post" / cascade cleanup on delete.
likeSchema.index({ blog: 1 });
likeSchema.index({ comment: 1 });

export default mongoose.model("like", likeSchema);
