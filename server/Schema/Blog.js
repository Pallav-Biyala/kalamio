import mongoose, { Schema } from "mongoose";

const blogSchema = mongoose.Schema({

    blog_id: {
        type: String,
        required: true,
        unique: true,
    },
    title: {
        type: String,
        required: true,
    },
    banner: {
        type: String,
        // required: true,
    },
    des: {
        type: String,
        maxlength: 200,
        // required: true
    },
    // EditorJS saves { blocks: [...] }. Stored as an array for legacy reasons.
    // Frontend handles both content[0].blocks and content.blocks patterns.
    content: {
        type: [Schema.Types.Mixed],
        // required: true
    },
    tags: {
        type: [String],
        // required: true
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
        total_likes: {
            type: Number,
            default: 0
        },
        total_comments: {
            type: Number,
            default: 0
        },
        total_reads: {
            type: Number,
            default: 0
        },
        total_parent_comments: {
            type: Number,
            default: 0
        },
    },
    comments: {
        type: [Schema.Types.ObjectId],
        ref: 'comments'
    },
    readTime: {
        type: Number,
        default: 1
    },
    draft: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }

}, 
{ 
    timestamps: {
        createdAt: 'publishedAt'
    } 

})

// ── Soft delete: auto-filter deleted documents from all queries ─────
// Queries explicitly requesting { deletedAt: { $ne: null } } still work.
const softDeleteFilter = function() {
    if (!this.getQuery().deletedAt) {
        this.where({ deletedAt: null });
    }
};
blogSchema.pre('find', softDeleteFilter);
blogSchema.pre('findOne', softDeleteFilter);
blogSchema.pre('findOneAndUpdate', softDeleteFilter);
blogSchema.pre('countDocuments', softDeleteFilter);

// ── Indexes for query performance ──────────────────────────────────
blogSchema.index({ tags: 1 });
blogSchema.index({ draft: 1, publishedAt: -1 });
blogSchema.index({ author: 1, draft: 1, publishedAt: -1 });  // userWrittenBlogs, deleteBlog
blogSchema.index({ publication: 1, draft: 1, publishedAt: -1 }); // publication blog listings

export default mongoose.model("blogs", blogSchema);