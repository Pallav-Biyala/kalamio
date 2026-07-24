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
    // Portrait cover for the vertical "scroll" (Reads/reels) feed. Optional — the reads page falls
    // back to `banner` when this is empty. Lets the author crop the banner (or upload a different
    // photo) to the reel's 9:16 shape instead of an arbitrary centre-crop of the landscape banner.
    scroll_image: {
        type: String,
        default: '',
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