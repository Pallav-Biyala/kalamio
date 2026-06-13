import mongoose, { Schema } from "mongoose";

const postSchema = new mongoose.Schema({
    blog_id: {
        type: String,
        required: true,
        unique: true,
    },
    author: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    publication: {
        type: Schema.Types.ObjectId,
        ref: 'publications',
        default: null
    },
    activity: {
        total_likes: { type: Number, default: 0 },
        total_comments: { type: Number, default: 0 },
        total_reads: { type: Number, default: 0 },
        total_parent_comments: { type: Number, default: 0 },
    },
    comments: {
        type: [Schema.Types.ObjectId],
        ref: 'comments'
    },
    draft: {
        type: Boolean,
        default: false
    },
    edited: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'publishedAt' },
    discriminatorKey: 'type',
    collection: 'blogs'   // Keep using the existing 'blogs' collection
});

// Soft delete: auto-filter deleted documents from all queries
const softDeleteFilter = function() {
    if (!this.getQuery().deletedAt) {
        this.where({ deletedAt: null });
    }
};
postSchema.pre('find', softDeleteFilter);
postSchema.pre('findOne', softDeleteFilter);
postSchema.pre('findOneAndUpdate', softDeleteFilter);
postSchema.pre('countDocuments', softDeleteFilter);

// Indexes for query performance
postSchema.index({ tags: 1 });
postSchema.index({ draft: 1, publishedAt: -1 });
postSchema.index({ author: 1, draft: 1, publishedAt: -1 });
postSchema.index({ publication: 1, draft: 1, publishedAt: -1 });

const Post = mongoose.model("blogs", postSchema);

export default Post;
export { postSchema };
