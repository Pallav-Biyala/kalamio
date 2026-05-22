import Publication from '../Schema/Publication.js';
import Subscription from '../Schema/Subscription.js';
import Notification from '../Schema/Notification.js';
import User from '../Schema/User.js';
import Blog from '../Schema/Blog.js';

// ────────────────────────────────────────────────────────
// PUBLICATION CRUD
// ────────────────────────────────────────────────────────

/**
 * POST /api/publication/create
 * Create a new publication.
 */
export const createPublication = async (req, res) => {
    try {
        const owner_id = req.user;
        const { title, description, banner, tags } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: "Publication title is required" });
        }

        // Generate slug from title
        let baseSlug = title.trim().toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 80);

        // Ensure unique slug
        let slug = baseSlug;
        let counter = 1;
        while (await Publication.exists({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const publication = await new Publication({
            title: title.trim(),
            slug,
            description: description?.trim() || "",
            banner: banner || "",
            tags: tags || [],
            owner: owner_id
        }).save();

        return res.status(201).json({ publication });

    } catch (err) {
        console.error('[Publication] createPublication failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/update
 * Update an existing publication (owner only).
 */
export const updatePublication = async (req, res) => {
    try {
        const owner_id = req.user;
        const { publication_id, title, description, banner, tags } = req.body;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const publication = await Publication.findOne({ _id: publication_id, owner: owner_id });
        if (!publication) {
            return res.status(404).json({ error: "Publication not found or not owned by you" });
        }

        if (title) publication.title = title.trim();
        if (description !== undefined) publication.description = description.trim();
        if (banner !== undefined) publication.banner = banner;
        if (tags) publication.tags = tags;

        await publication.save();

        return res.status(200).json({ publication });

    } catch (err) {
        console.error('[Publication] updatePublication failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/delete
 * Delete a publication (owner only). Unlinks all blogs and removes subscriptions.
 */
export const deletePublication = async (req, res) => {
    try {
        const owner_id = req.user;
        const { publication_id } = req.body;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const publication = await Publication.findOne({ _id: publication_id, owner: owner_id });
        if (!publication) {
            return res.status(404).json({ error: "Publication not found or not owned by you" });
        }

        // Unlink all blogs from this publication
        await Blog.updateMany({ publication: publication_id }, { $unset: { publication: "" } });

        // Remove all subscriptions
        await Subscription.deleteMany({ publication: publication_id });

        // Delete the publication
        await Publication.findByIdAndDelete(publication_id);

        return res.status(200).json({ deleted: true });

    } catch (err) {
        console.error('[Publication] deletePublication failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/get
 * Get a publication by slug (public).
 */
export const getPublication = async (req, res) => {
    try {
        const { slug } = req.body;

        if (!slug) {
            return res.status(400).json({ error: "Slug is required" });
        }

        const publication = await Publication.findOne({ slug })
            .populate("owner", "personal_info.fullname personal_info.username personal_info.profile_img");

        if (!publication) {
            return res.status(404).json({ error: "Publication not found" });
        }

        return res.status(200).json({ publication });

    } catch (err) {
        console.error('[Publication] getPublication failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/blogs
 * Get paginated blogs under a publication (public).
 */
export const getPublicationBlogs = async (req, res) => {
    try {
        const { publication_id, page = 1 } = req.body;
        const maxLimit = 5;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const blogs = await Blog.find({ publication: publication_id, draft: false })
            .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
            .populate("publication", "title slug")
            .sort({ publishedAt: -1 })
            .select("blog_id title des banner activity tags readTime publishedAt publication")
            .skip((page - 1) * maxLimit)
            .limit(maxLimit);

        return res.status(200).json({ blogs });

    } catch (err) {
        console.error('[Publication] getPublicationBlogs failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/blogs-count
 * Count blogs in a publication.
 */
export const getPublicationBlogsCount = async (req, res) => {
    try {
        const { publication_id } = req.body;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const count = await Blog.countDocuments({ publication: publication_id, draft: false });
        return res.status(200).json({ totalDocs: count });

    } catch (err) {
        console.error('[Publication] getPublicationBlogsCount failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/user-publications
 * Get all publications owned by a user (public).
 */
export const getUserPublications = async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const publications = await Publication.find({ owner: user_id })
            .sort({ createdAt: -1 })
            .select("title slug description banner tags total_subscribers total_posts createdAt");

        return res.status(200).json({ publications });

    } catch (err) {
        console.error('[Publication] getUserPublications failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/my-publications
 * Get publications owned by the logged-in user (for dashboard).
 */
export const getMyPublications = async (req, res) => {
    try {
        const owner_id = req.user;

        const publications = await Publication.find({ owner: owner_id })
            .sort({ createdAt: -1 })
            .select("title slug description banner tags total_subscribers total_posts createdAt");

        return res.status(200).json({ publications });

    } catch (err) {
        console.error('[Publication] getMyPublications failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/add-blog
 * Link an existing blog to a publication (owner only).
 */
export const addBlogToPublication = async (req, res) => {
    try {
        const owner_id = req.user;
        const { publication_id, blog_id } = req.body;

        if (!publication_id || !blog_id) {
            return res.status(400).json({ error: "Publication ID and Blog ID are required" });
        }

        // Verify ownership of publication
        const publication = await Publication.findOne({ _id: publication_id, owner: owner_id });
        if (!publication) {
            return res.status(404).json({ error: "Publication not found or not owned by you" });
        }

        // Verify ownership of blog
        const blog = await Blog.findOne({ _id: blog_id, author: owner_id });
        if (!blog) {
            return res.status(404).json({ error: "Blog not found or not authored by you" });
        }

        // If blog is already in a different publication, update counts
        if (blog.publication && blog.publication.toString() !== publication_id) {
            await Publication.findByIdAndUpdate(blog.publication, { $inc: { total_posts: -1 } });
        }

        // Link blog to publication
        const wasAlreadyLinked = blog.publication?.toString() === publication_id;
        blog.publication = publication_id;
        await blog.save();

        if (!wasAlreadyLinked) {
            await Publication.findByIdAndUpdate(publication_id, { $inc: { total_posts: 1 } });
        }

        return res.status(200).json({ linked: true });

    } catch (err) {
        console.error('[Publication] addBlogToPublication failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/publication/remove-blog
 * Unlink a blog from a publication (owner only).
 */
export const removeBlogFromPublication = async (req, res) => {
    try {
        const owner_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) {
            return res.status(400).json({ error: "Blog ID is required" });
        }

        const blog = await Blog.findOne({ _id: blog_id, author: owner_id });
        if (!blog || !blog.publication) {
            return res.status(200).json({ unlinked: true });
        }

        const pub_id = blog.publication;
        blog.publication = undefined;
        await blog.save();

        await Publication.findByIdAndUpdate(pub_id, { $inc: { total_posts: -1 } });

        return res.status(200).json({ unlinked: true });

    } catch (err) {
        console.error('[Publication] removeBlogFromPublication failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// SUBSCRIBE / UNSUBSCRIBE
// ────────────────────────────────────────────────────────

/**
 * POST /api/subscribe
 * Subscribe to a publication.
 */
export const subscribe = async (req, res) => {
    try {
        const subscriber_id = req.user;
        const { publication_id } = req.body;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const publication = await Publication.findById(publication_id).select("owner");
        if (!publication) {
            return res.status(404).json({ error: "Publication not found" });
        }

        // Idempotent
        const existing = await Subscription.findOne({ subscriber: subscriber_id, publication: publication_id });
        if (existing) {
            return res.status(200).json({ subscribed: true });
        }

        await new Subscription({ subscriber: subscriber_id, publication: publication_id }).save();

        // Update subscriber count
        await Publication.findByIdAndUpdate(publication_id, { $inc: { total_subscribers: 1 } });

        // Notify publication owner
        if (publication.owner.toString() !== subscriber_id) {
            new Notification({
                type: "subscribe",
                notification_for: publication.owner,
                user: subscriber_id,
            }).save().catch(err => console.error('[Publication] Notification error:', err.message));
        }

        return res.status(200).json({ subscribed: true });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(200).json({ subscribed: true });
        }
        console.error('[Publication] subscribe failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/unsubscribe
 * Unsubscribe from a publication.
 */
export const unsubscribe = async (req, res) => {
    try {
        const subscriber_id = req.user;
        const { publication_id } = req.body;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const result = await Subscription.findOneAndDelete({
            subscriber: subscriber_id,
            publication: publication_id
        });

        if (!result) {
            return res.status(200).json({ subscribed: false });
        }

        await Publication.findByIdAndUpdate(publication_id, { $inc: { total_subscribers: -1 } });

        return res.status(200).json({ subscribed: false });

    } catch (err) {
        console.error('[Publication] unsubscribe failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/is-subscribed
 * Check if logged-in user is subscribed to a publication.
 */
export const isSubscribed = async (req, res) => {
    try {
        const subscriber_id = req.user;
        const { publication_id } = req.body;

        if (!publication_id) {
            return res.status(400).json({ error: "Publication ID is required" });
        }

        const exists = await Subscription.exists({ subscriber: subscriber_id, publication: publication_id });
        return res.status(200).json({ subscribed: !!exists });

    } catch (err) {
        console.error('[Publication] isSubscribed failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/my-subscriptions
 * List publications the logged-in user subscribes to.
 */
export const getMySubscriptions = async (req, res) => {
    try {
        const subscriber_id = req.user;

        const subs = await Subscription.find({ subscriber: subscriber_id })
            .populate({
                path: "publication",
                select: "title slug description banner total_subscribers total_posts owner",
                populate: { path: "owner", select: "personal_info.username personal_info.fullname personal_info.profile_img" }
            })
            .sort({ subscribedAt: -1 });

        const publications = subs
            .filter(s => s.publication) // Guard against deleted publications
            .map(s => s.publication);

        return res.status(200).json({ publications });

    } catch (err) {
        console.error('[Publication] getMySubscriptions failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
