import mongoose, { Schema } from "mongoose";

const collectionSchema = mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxlength: [100, 'Collection title cannot exceed 100 characters']
    },
    description: {
        type: String,
        default: '',
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    cover_image: {
        type: String,
        default: ''
    },
    slug: {
        type: String,
        required: true,
        lowercase: true
    },

    // Ownership
    owner: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    publication: {
        type: Schema.Types.ObjectId,
        ref: 'publications',
        default: null
    },

    // Type: user collection or publication collection
    type: {
        type: String,
        enum: ['user', 'publication'],
        default: 'user'
    },

    // Visibility
    visibility: {
        type: String,
        enum: ['public', 'private', 'unlisted'],
        default: 'private'
    },

    // Default "Read Later" collection — cannot be deleted or renamed
    is_default: {
        type: Boolean,
        default: false
    },

    // Embedded articles
    articles: [{
        blog: {
            type: Schema.Types.ObjectId,
            ref: 'blogs',
            required: true
        },
        added_at: {
            type: Date,
            default: Date.now
        },
        order: {
            type: Number,
            default: 0
        }
    }],

    total_articles: {
        type: Number,
        default: 0
    }
},
{
    timestamps: true
});

// ── Indexes ──────────────────────────────────────────────
// User's collections sorted by newest
collectionSchema.index({ owner: 1, type: 1, createdAt: -1 });

// Publication's collections
collectionSchema.index({ publication: 1, createdAt: -1 });

// Unique slug per owner
collectionSchema.index({ owner: 1, slug: 1 }, { unique: true });

// Find which collections contain an article
collectionSchema.index({ 'articles.blog': 1 });

// Quick lookup for default collection
collectionSchema.index({ owner: 1, is_default: 1 });

export default mongoose.model("collections", collectionSchema);
