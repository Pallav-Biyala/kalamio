import mongoose, { Schema } from "mongoose";
import Post from "./Post.js";

const textPostSchema = new mongoose.Schema({
    text_content: {
        type: String,
        maxlength: 9999,
    },
    images: {
        type: [String],
        default: [],
    },
    poll: {
        question: { type: String },
        options: [{
            text: { type: String },
            votes: { type: Number, default: 0 },
        }],
        total_votes: { type: Number, default: 0 },
        ends_at: { type: Date },
    },
});

const TextPost = Post.discriminator('text_post', textPostSchema);

export default TextPost;
