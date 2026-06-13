import mongoose, { Schema } from "mongoose";
import Post from "./Post.js";

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    banner: {
        type: String,
    },
    des: {
        type: String,
        maxlength: 200,
    },
    // Supports both Tiptap JSON { type: "doc", content: [...] } and legacy EditorJS { blocks: [...] }.
    // Frontend auto-detects format for rendering.
    content: {
        type: [Schema.Types.Mixed],
    },
    tags: {
        type: [String],
    },
    readTime: {
        type: Number,
        default: 1
    },
});

const Blog = Post.discriminator('blog', blogSchema);

export default Blog;