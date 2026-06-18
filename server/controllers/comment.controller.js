import Comment from '../Schema/Comment.js';
import Post from '../Schema/Post.js';
import Notification from '../Schema/Notification.js';
import sanitizeHtml from 'sanitize-html';

// Delete comments helper (recursive)
const deleteComments = (_id) => {
    Comment.findOneAndDelete({ _id })
    .then(comment => {

        if(comment.parent){
            Comment.findOneAndUpdate({ _id: comment.parent }, { $pull: { children: _id } })
            .catch(err => console.error('[Comment] Failed to remove from parent:', err.message))
        }

        Notification.findOneAndDelete({ comment: _id })
        .catch(err => console.error('[Comment] Failed to delete notification:', err.message));
        
        Notification.findOneAndUpdate({ reply: _id }, { $unset: { reply: 1 } })
        .catch(err => console.error('[Comment] Failed to unset reply notification:', err.message));

        Post.findOneAndUpdate({ _id: comment.blog_id }, { $pull: { comments: _id }, $inc: { 'activity.total_comments': -1 }, "activity.total_parent_comments": comment.parent ? 0 : -1 })
        .then(blog => {
            if(comment.children.length){
                comment.children.map(replies => {
                    deleteComments(replies)
                })
            }
        })
        .catch(err => console.error('[Comment] Failed to update blog activity:', err.message))

    })
    .catch(err => {
        console.error('[Comment] deleteComments failed:', err.message);
    })
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

        Post.findOneAndUpdate({ _id }, { 
            $push: { "comments": commentFile._id }, 
            $inc: { "activity.total_comments": 1, "activity.total_parent_comments": replying_to ? 0 : 1  }
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

    let maxLimit = 5;

    try {
        // Auto-sync counter
        const actual_count = await Comment.countDocuments({ blog_id, isReply: false });
        await Post.updateOne({ _id: blog_id }, { $set: { "activity.total_parent_comments": actual_count } });

        const comment = await Comment.find({ blog_id, isReply: false })
            .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img")
            .skip(skip)
            .limit(maxLimit)
            .sort({
                'commentedAt': -1
            });
            
        return res.status(200).json(comment);
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
        return res.status(200).json({ replies: doc.children })
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
    .then(comment => {

        if(user_id == comment.commented_by.toString() || user_id == comment.blog_author.toString()){

            deleteComments(_id)

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
        if (latestReply && latestReply.commented_by._id.toString() !== blog_author_id) {
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

        let incrementVal = !isLikedByUser ? 1 : -1;

        let comment = await Comment.findOneAndUpdate(
            { _id },
            { $inc: { "activity.total_likes": incrementVal } },
            { new: true }
        );

        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }

        if (!isLikedByUser) {
            // Like — create notification if not already exists
            let existing = await Notification.findOne({ user: user_id, comment: _id, type: "comment_like" });
            if (!existing) {
                await new Notification({
                    type: "comment_like",
                    blog: comment.blog_id,
                    comment: _id,
                    notification_for: comment.commented_by,
                    user: user_id
                }).save();
            }
            return res.status(200).json({ liked_by_user: true, total_likes: comment.activity.total_likes });
        } else {
            // Unlike — remove notification
            await Notification.findOneAndDelete({ user: user_id, comment: _id, type: "comment_like" });
            return res.status(200).json({ liked_by_user: false, total_likes: comment.activity.total_likes });
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

        let exists = await Notification.exists({ user: user_id, comment: _id, type: "comment_like" });

        return res.status(200).json({ result: !!exists });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
