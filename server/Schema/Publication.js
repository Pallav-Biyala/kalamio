import mongoose, { Schema } from "mongoose";

const publicationSchema = mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Title must be under 100 characters']
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    description: {
        type: String,
        maxlength: [500, 'Description must be under 500 characters'],
        default: ""
    },
    banner: {
        type: String,
        default: ""
    },
    owner: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    tags: {
        type: [String],
        default: []
    },
    total_subscribers: {
        type: Number,
        default: 0
    },
    total_posts: {
        type: Number,
        default: 0
    },
    visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    }
},
{
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

// Find by slug quickly
publicationSchema.index({ slug: 1 }, { unique: true });

// Find all publications by owner
publicationSchema.index({ owner: 1, createdAt: -1 });

// Discover popular publications
publicationSchema.index({ total_subscribers: -1 });

export default mongoose.model("publications", publicationSchema);
