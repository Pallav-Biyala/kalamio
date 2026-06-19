import mongoose, { Schema } from "mongoose";

const bookmarkSchema = mongoose.Schema({
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users'
    },
    blog: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'blogs'
    }
},
{
    timestamps: {
        createdAt: 'savedAt',
        updatedAt: false
    }
});

// Unique — a user can only bookmark a blog once
bookmarkSchema.index({ user: 1, blog: 1 }, { unique: true });

// List all bookmarks of a user (sorted by newest)
bookmarkSchema.index({ user: 1, savedAt: -1 });

// List all users who bookmarked a blog (sorted by newest)
bookmarkSchema.index({ blog: 1, savedAt: -1 });

export default mongoose.model("bookmarks", bookmarkSchema);
