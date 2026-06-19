import Bookmark from '../Schema/Bookmark.js';
import Post from '../Schema/Post.js';

// ────────────────────────────────────────────────────────
// BOOKMARK CRUD
// ────────────────────────────────────────────────────────

/**
 * POST /api/v1/bookmark
 * Bookmark a blog post.
 */
export const addBookmark = async (req, res) => {
    try {
        const user_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) {
            return res.status(400).json({ error: "Blog ID is required" });
        }

        const blog = await Post.findOne({ blog_id }).select("_id");
        if (!blog) {
            return res.status(404).json({ error: "Blog not found" });
        }

        await new Bookmark({ user: user_id, blog: blog._id }).save();

        return res.status(200).json({ bookmarked: true });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "Blog already bookmarked" });
        }
        console.error('[Bookmark] addBookmark failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/remove-bookmark
 * Remove a bookmark from a blog post.
 */
export const removeBookmark = async (req, res) => {
    try {
        const user_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) {
            return res.status(400).json({ error: "Blog ID is required" });
        }

        const blog = await Post.findOne({ blog_id }).select("_id");
        if (!blog) {
            return res.status(200).json({ bookmarked: false });
        }

        await Bookmark.findOneAndDelete({ user: user_id, blog: blog._id });

        return res.status(200).json({ bookmarked: false });

    } catch (err) {
        console.error('[Bookmark] removeBookmark failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/bookmarks
 * Get paginated bookmarks for the logged-in user.
 */
export const getBookmarks = async (req, res) => {
    try {
        const user_id = req.user;
        const { page = 1 } = req.body;
        const maxLimit = 10;

        const bookmarks = await Bookmark.find({ user: user_id })
            .populate({
                path: "blog",
                select: "blog_id title banner description tags activity publishedAt text_content post_type",
                populate: {
                    path: "author",
                    select: "personal_info.fullname personal_info.username personal_info.profile_img"
                }
            })
            .sort({ savedAt: -1 })
            .skip((page - 1) * maxLimit)
            .limit(maxLimit);

        return res.status(200).json({ bookmarks });

    } catch (err) {
        console.error('[Bookmark] getBookmarks failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/is-bookmarked
 * Check if the logged-in user has bookmarked a blog.
 */
export const isBookmarked = async (req, res) => {
    try {
        const user_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) {
            return res.status(400).json({ error: "Blog ID is required" });
        }

        const blog = await Post.findOne({ blog_id }).select("_id");
        if (!blog) {
            return res.status(200).json({ bookmarked: false });
        }

        const exists = await Bookmark.exists({ user: user_id, blog: blog._id });
        return res.status(200).json({ bookmarked: !!exists });

    } catch (err) {
        console.error('[Bookmark] isBookmarked failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/bookmarks-count
 * Count total bookmarks for the logged-in user.
 */
export const getBookmarksCount = async (req, res) => {
    try {
        const user_id = req.user;

        const count = await Bookmark.countDocuments({ user: user_id });
        return res.status(200).json({ totalDocs: count });

    } catch (err) {
        console.error('[Bookmark] getBookmarksCount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
