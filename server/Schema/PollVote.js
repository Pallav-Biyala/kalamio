import mongoose, { Schema } from "mongoose";

const pollVoteSchema = new Schema({
    blog_id: {
        type: String,
        required: true,
    },
    user: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    option_index: {
        type: Number,
        required: true,
    },
}, { timestamps: true });

// One vote per user per poll
pollVoteSchema.index({ blog_id: 1, user: 1 }, { unique: true });

export default mongoose.model("poll_votes", pollVoteSchema);
