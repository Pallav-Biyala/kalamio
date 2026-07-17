import Comment from '../Schema/Comment.js';
import Post from '../Schema/Post.js';
import Notification from '../Schema/Notification.js';
import Like from '../Schema/Like.js';
import { emitNotification, emitBlogUpdate } from '../utils/notify.js';
import sanitizeHtml from 'sanitize-html';

// Delete comments helper (recursive). `req` is threaded through so the post-decrement count can be
// broadcast live to everyone viewing the post (blog:<id> room), mirroring addComment's count-up.
// Async and AWAITED all the way down: the delete-comment route invalidates the cached feed when the
// handler responds, so every activity.total_comments decrement in the cascade must be committed
// before res.json — a fire-and-forget cascade let the cache flush outrun the DB writes and re-cache
// the stale count for a full TTL. Side effects that never appear in cached reads (parent pulls,
// notifications, comment-likes) stay fire-and-forget.
const deleteComments = async (_id, req) => {
    try {
        const comment = await Comment.findOneAndDelete({ _id });
        if (!comment) return;

        if(comment.parent){
            Comment.findOneAndUpdate({ _id: comment.parent }, { $pull: { children: _id } })
            .catch(err => console.error('[Comment] Failed to remove from parent:', err.message))
        }

        Notification.findOneAndDelete({ comment: _id })
        .catch(err => console.error('[Comment] Failed to delete notification:', err.message));

        // Likes are their own records now, so a deleted comment needs its likes cascaded too.
        Like.deleteMany({ comment: _id })
        .catch(err => console.error('[Comment] Failed to delete likes:', err.message));

        Notification.findOneAndUpdate({ reply: _id }, { $unset: { reply: 1 } })
        .catch(err => console.error('[Comment] Failed to unset reply notification:', err.message));

        // total_parent_comments MUST live inside $inc (as addComment does). As a bare field beside
        // $inc/$pull it's a non-operator key, which MongoDB rejects — the whole update was failing
        // into the catch, so deletes never decremented the count or pulled the ref. { new: true }
        // returns the fresh doc so we can broadcast the decremented count.
        const blog = await Post.findOneAndUpdate(
            { _id: comment.blog_id },
            { $pull: { comments: _id }, $inc: { 'activity.total_comments': -1, 'activity.total_parent_comments': comment.parent ? 0 : -1 } },
            { new: true }
        ).catch(err => { console.error('[Comment] Failed to update blog activity:', err.message); return null; });

        // Push the decremented count so it falls live for other viewers (delete path was the
        // only engagement mutation missing its emitBlogUpdate).
        if (blog) emitBlogUpdate(req, blog._id, { total_comments: blog.activity.total_comments });

        if(comment.children.length){
            await Promise.all(comment.children.map(replies => deleteComments(replies, req)));
        }
    } catch (err) {
        console.error('[Comment] deleteComments failed:', err.message);
    }
};

// Add comment
export const addComment = (req, res) => {

    let user_id = req.user;

    let { _id, comment, blog_author, replying_to, notification_id, images, poll } = req.body;

    // Sanitize comment — strip all HTML to prevent XSS
    const sanitizedComment = sanitizeHtml(comment, { allowedTags: [], allowedAttributes: {} });

    if (!sanitizedComment.length) {
        return res.status(403).json({ error: "Write something to leave a comment" });
    }

    let commentObj = {
        blog_id: _id,
        blog_author,
        comment: sanitizedComment,
        images: images || [],
        poll: poll || undefined,
        commented_by: user_id,
    }

    if(replying_to){
        commentObj.parent = replying_to;
        commentObj.isReply = true;
    }

    new Comment(commentObj).save().then( async commentFile => {

        let { comment, commentedAt, children } = commentFile;

        // Awaited (not fire-and-forget): the route's invalidateCacheOnWrite(['feed']) flushes the
        // cached feed when res.json fires, so the count increment must be committed BEFORE we
        // respond — otherwise a concurrent feed request could re-cache the pre-comment count for a
        // full TTL. Failure still only logs (the comment itself saved fine).
        await Post.findOneAndUpdate({ _id }, {
            $push: { "comments": commentFile._id },
            $inc: { "activity.total_comments": 1, "activity.total_parent_comments": replying_to ? 0 : 1  }
        }, { new: true })
        .then(updated => {
            // Push the new comment count to everyone viewing this post (live counts).
            if (updated) emitBlogUpdate(req, updated._id, { total_comments: updated.activity.total_comments });
        })
        .catch(err => console.error('[Comment] Failed to update blog:', err.message));

        let notificationObj = {
            type: replying_to ? "reply" : "comment",
            blog: _id,
            notification_for: blog_author,
            user: user_id,
            comment: commentFile._id
        }

        if(replying_to){

            notificationObj.replied_on_comment = replying_to;

            await Comment.findOneAndUpdate({ _id: replying_to }, { $push: {children: commentFile._id} })
            .then(replyingToCommentDoc => {
                notificationObj.notification_for = replyingToCommentDoc.commented_by
            })

            if(notification_id){
                Notification.findOneAndUpdate({ _id: notification_id }, { reply: commentFile._id })
                .catch(err => console.error('[Comment] Failed to update notification reply:', err.message));
            }

        }

        new Notification(notificationObj).save()
        .then(() => {
            // Don't push a live notification for acting on your own content.
            if (String(notificationObj.notification_for) !== String(user_id)) {
                emitNotification(req, notificationObj.notification_for, { type: notificationObj.type });
            }
        })
        .catch(err => console.error('[Comment] Failed to create notification:', err.message));

        return res.status(200).json({
            comment,
            commentedAt,
            _id: commentFile._id,
            user_id,
            children
        })

    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })

};

// Get blog comments
export const getBlogComments = async (req, res) => {

    let { blog_id, skip } = req.body;

    // Top-level comments loaded per page (initial load + each "Load More").
    const maxLimit = 10;
    const skipCount = Math.max(0, parseInt(skip) || 0);

    try {
        // Fetch the requested page of top-level comments.
        const comment = await Comment.find({ blog_id, isReply: false })
            .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img")
            .skip(skipCount)
            .limit(maxLimit)
            .sort({
                'commentedAt': -1
            });

        // A comment whose author account was deleted populates to a null commented_by, so the UI
        // filters it out — but it's still a stored document, so it keeps inflating the count. Delete
        // these ghosts (and their direct replies) and pull their Post.comments refs.
        const orphanIds = comment.filter(c => c.commented_by == null).map(c => c._id);
        if (orphanIds.length) {
            await Comment.deleteMany({ $or: [{ _id: { $in: orphanIds } }, { parent: { $in: orphanIds } }] });
            await Post.updateOne({ _id: blog_id }, { $pull: { comments: { $in: orphanIds } } });
        }

        // Count the true document totals.
        let [total_comments, total_parent_comments] = await Promise.all([
            Comment.countDocuments({ blog_id }),
            Comment.countDocuments({ blog_id, isReply: false }),
        ]);

        // If no top-level comments remain but documents still exist, those are replies orphaned by the
        // historical delete bug: it deleted a parent comment but left its replies behind (the recursive
        // child-delete lived inside the Post update's .then, which never ran because that update was
        // failing). Orphaned replies have no surviving parent, so they never render yet still inflate
        // the count — this is the "comments array empty but count shows 1" case. Purge them.
        if (total_parent_comments === 0 && total_comments > 0) {
            await Comment.deleteMany({ blog_id });
            await Post.updateOne({ _id: blog_id }, { $set: { comments: [] } });
            total_comments = 0;
        }

        // Persist the healed counts. total_comments counts replies too; total_parent_comments is
        // top-level only.
        await Post.updateOne({ _id: blog_id }, { $set: {
            "activity.total_comments": total_comments,
            "activity.total_parent_comments": total_parent_comments,
        } });

        const validComments = comment.filter(c => c.commented_by != null);

        return res.status(200).json({ comments: validComments, total_comments, total_parent_comments });
    } catch (err) {
        console.error('[Comment] getBlogComments failed:', err.message);
        return res.status(500).json({ error: err.message });
    }

};

// Get replies
export const getReplies = (req, res) => {

    let { _id, skip } = req.body;

    let maxLimit = 5;

    Comment.findOne({ _id })
    .populate({
        path: "children",
        options: {
            limit: maxLimit,
            skip: skip,
            sort: { 'commentedAt': -1 }
        },
        populate: {
            path: 'commented_by',
            select: "personal_info.profile_img personal_info.fullname personal_info.username"
        },
        select: "-blog_id -updatedAt"
    })
    .select("children")
    .then(doc => {
        // Filter out replies whose author was deleted
        const validReplies = (doc.children || []).filter(c => c.commented_by != null);
        return res.status(200).json({ replies: validReplies })
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })

};

// Delete comment
export const deleteComment = (req, res) => {

    let user_id = req.user;

    let { _id } = req.body;

    Comment.findOne({ _id })
    .then(async comment => {

        if(user_id == comment.commented_by.toString() || user_id == comment.blog_author.toString()){

            // Awaited so the route's invalidateCacheOnWrite(['feed']) — which fires on res.json —
            // flushes the cached feed only AFTER the count decrements committed. Also means the
            // client's post-delete refetch can no longer see not-yet-deleted replies.
            await deleteComments(_id, req)

            return res.status(200).json({ 'status': 'done' });

        } else {
            return res.status(403).json({ error: "You can not delete this comment" });
        }

    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })

};

// Get comment thread (with full ancestor chain)
export const getCommentThread = async (req, res) => {
    try {
        let { comment_id } = req.body;

        let comment = await Comment.findOne({ _id: comment_id })
            .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img");

        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }

        // Walk up the parent chain to build ancestors array
        let ancestors = [];
        let current = comment;
        while (current.parent) {
            let parentComment = await Comment.findOne({ _id: current.parent })
                .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img");
            if (parentComment) {
                ancestors.unshift(parentComment); // prepend so oldest ancestor is first
                current = parentComment;
            } else {
                break;
            }
        }

        let blog = await Post.findOne({ _id: comment.blog_id })
            .populate("author", "personal_info.username personal_info.fullname personal_info.profile_img")
            .select("title text_content author publishedAt activity type images poll blog_id");

        return res.status(200).json({ comment, ancestors, blog_context: blog });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Get preview replies
export const getPreviewReplies = (req, res) => {
    let { comment_id } = req.body;

    Comment.findOne({ _id: comment_id })
    .then(async parentComment => {
        if (!parentComment) {
            return res.status(404).json({ error: "Comment not found" });
        }

        let reply_count = parentComment.children.length;
        if (reply_count === 0) {
            return res.status(200).json({ replies: [], reply_count: 0 });
        }

        // Get the blog to find the author
        let blog = await Post.findOne({ _id: parentComment.blog_id }).select("author");
        let blog_author_id = blog.author.toString();

        // Get latest reply
        let latestReply = await Comment.findOne({ parent: comment_id })
            .sort({ commentedAt: -1 })
            .limit(1)
            .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img");

        // Check if author has replied
        let authorReply = null;
        if (latestReply && latestReply.commented_by && latestReply.commented_by._id.toString() !== blog_author_id) {
            // Latest reply is NOT by the author, so check if author has replied at all
            authorReply = await Comment.findOne({ parent: comment_id, commented_by: blog_author_id })
                .sort({ commentedAt: -1 })
                .limit(1)
                .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img");
        }

        let replies = [latestReply];
        if (authorReply && authorReply._id.toString() !== latestReply._id.toString()) {
            replies = [authorReply, latestReply]; // Author reply shown first
        }

        return res.status(200).json({ replies: replies.filter(Boolean), reply_count });
    })
    .catch(err => res.status(500).json({ error: err.message }));
};

// Like / Unlike a comment
export const likeComment = async (req, res) => {
    try {
        let user_id = req.user;
        let { _id, isLikedByUser } = req.body;

        if (!_id) {
            return res.status(400).json({ error: "Comment ID is required" });
        }

        // `isLikedByUser` is the CLIENT's belief and can be stale, unresolved, or a rapid second
        // click's flipped optimistic flag — so the like row, not the flag, drives the counter.
        // Previously the count was $inc'd unconditionally before any existence check, so a
        // double-like added +2 and repeat unlikes could drive it negative.
        const currentLikes = async () => {
            const doc = await Comment.findById(_id).select("activity.total_likes");
            return doc?.activity?.total_likes ?? 0;
        };

        if (!isLikedByUser) {
            // Unique (user, comment) index ⇒ only one of any concurrent likes inserts.
            const result = await Like.updateOne(
                { user: user_id, comment: _id },
                { $setOnInsert: { user: user_id, comment: _id } },
                { upsert: true },
            );
            if ((result.upsertedCount ?? 0) === 0) {
                return res.status(200).json({ liked_by_user: true, total_likes: await currentLikes() });
            }

            const comment = await Comment.findOneAndUpdate(
                { _id },
                { $inc: { "activity.total_likes": 1 } },
                { new: true },
            );
            if (!comment) {
                await Like.deleteOne({ user: user_id, comment: _id });
                return res.status(404).json({ error: "Comment not found" });
            }

            // Notification is only the author's inbox item now; deleting it can't unlike anything.
            if (String(comment.commented_by) !== String(user_id)) {
                await new Notification({
                    type: "comment_like",
                    blog: comment.blog_id,
                    comment: _id,
                    notification_for: comment.commented_by,
                    user: user_id
                }).save();
                emitNotification(req, comment.commented_by, { type: "comment_like" });
            }
            return res.status(200).json({ liked_by_user: true, total_likes: comment.activity.total_likes });
        } else {
            const removal = await Like.deleteOne({ user: user_id, comment: _id });
            if ((removal.deletedCount ?? 0) === 0) {
                return res.status(200).json({ liked_by_user: false, total_likes: await currentLikes() });
            }

            const comment = await Comment.findOneAndUpdate(
                { _id },
                { $inc: { "activity.total_likes": -1 } },
                { new: true },
            );
            await Notification.findOneAndDelete({ user: user_id, comment: _id, type: "comment_like" });

            return res.status(200).json({
                liked_by_user: false,
                total_likes: comment ? comment.activity.total_likes : await currentLikes(),
            });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Check if user has liked a comment
export const isCommentLiked = async (req, res) => {
    try {
        let user_id = req.user;
        let { _id } = req.body;

        if (!_id) {
            return res.status(400).json({ error: "Comment ID is required" });
        }

        // Reads the LIKE record — the author's notification is a separate, deletable inbox item.
        let exists = await Like.exists({ user: user_id, comment: _id });

        return res.status(200).json({ result: !!exists });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
