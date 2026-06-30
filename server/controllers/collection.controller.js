import Collection from '../Schema/Collection.js';
import Post from '../Schema/Post.js';
import Publication from '../Schema/Publication.js';

// ────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────

const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 60) + '-' + Date.now().toString(36);
};

/**
 * Get or create the user's default "Read Later" collection.
 */
const getOrCreateDefaultCollection = async (userId) => {
    let defaultCol = await Collection.findOne({ owner: userId, is_default: true });
    if (!defaultCol) {
        defaultCol = await new Collection({
            title: 'Read Later',
            description: 'Your saved articles',
            slug: 'read-later',
            owner: userId,
            type: 'user',
            visibility: 'private',
            is_default: true
        }).save();
    }
    return defaultCol;
};

// ────────────────────────────────────────────────────────
// COLLECTION CRUD
// ────────────────────────────────────────────────────────

/**
 * POST /collection/create
 */
export const createCollection = async (req, res) => {
    try {
        const user_id = req.user;
        const { title, description, visibility, publication_id } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ error: "Collection title is required" });
        }

        let type = 'user';
        let publication = null;

        // If creating a publication collection, verify ownership
        if (publication_id) {
            const pub = await Publication.findById(publication_id);
            if (!pub) return res.status(404).json({ error: "Publication not found" });
            if (pub.owner.toString() !== user_id) {
                return res.status(403).json({ error: "You don't own this publication" });
            }
            type = 'publication';
            publication = pub._id;
        }

        const collection = await new Collection({
            title: title.trim(),
            description: description?.trim() || '',
            slug: generateSlug(title),
            owner: user_id,
            publication,
            type,
            visibility: visibility || 'private'
        }).save();

        return res.status(200).json({ collection });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: "A collection with a similar name already exists" });
        }
        console.error('[Collection] createCollection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/update
 */
export const updateCollection = async (req, res) => {
    try {
        const user_id = req.user;
        const { collection_id, title, description, cover_image, visibility } = req.body;

        if (!collection_id) {
            return res.status(400).json({ error: "Collection ID is required" });
        }

        const collection = await Collection.findById(collection_id);
        if (!collection) return res.status(404).json({ error: "Collection not found" });
        if (collection.owner.toString() !== user_id) {
            return res.status(403).json({ error: "You don't own this collection" });
        }

        // Can't rename or change visibility of default collection
        if (collection.is_default && title && title.trim() !== collection.title) {
            return res.status(400).json({ error: "Cannot rename the default collection" });
        }
        if (collection.is_default && visibility && visibility !== 'private') {
            return res.status(400).json({ error: "Default collection is always private" });
        }

        const updates = {};
        if (title?.trim() && !collection.is_default) updates.title = title.trim();
        if (description !== undefined) updates.description = description.trim();
        if (cover_image !== undefined) updates.cover_image = cover_image;
        if (visibility && !collection.is_default) updates.visibility = visibility;

        const updated = await Collection.findByIdAndUpdate(
            collection_id,
            { $set: updates },
            { new: true }
        );

        return res.status(200).json({ collection: updated });

    } catch (err) {
        console.error('[Collection] updateCollection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/delete
 */
export const deleteCollection = async (req, res) => {
    try {
        const user_id = req.user;
        const { collection_id } = req.body;

        const collection = await Collection.findById(collection_id);
        if (!collection) return res.status(404).json({ error: "Collection not found" });
        if (collection.owner.toString() !== user_id) {
            return res.status(403).json({ error: "You don't own this collection" });
        }
        if (collection.is_default) {
            return res.status(400).json({ error: "Cannot delete the default collection" });
        }

        await Collection.findByIdAndDelete(collection_id);
        return res.status(200).json({ deleted: true });

    } catch (err) {
        console.error('[Collection] deleteCollection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/get
 * Get a single collection with paginated articles.
 */
export const getCollection = async (req, res) => {
    try {
        const { collection_id, page = 1 } = req.body;
        const user_id = req.user; // may be null for unauthenticated
        const maxLimit = 20;

        const collection = await Collection.findById(collection_id)
            .populate('owner', 'personal_info.fullname personal_info.username personal_info.profile_img')
            .populate('publication', 'title slug');

        if (!collection) return res.status(404).json({ error: "Collection not found" });

        // Visibility check
        const isOwner = user_id && collection.owner._id.toString() === user_id;
        if (collection.visibility === 'private' && !isOwner) {
            return res.status(404).json({ error: "Collection not found" });
        }

        // Paginate articles
        const startIdx = (page - 1) * maxLimit;
        const articleSlice = collection.articles
            .sort((a, b) => a.order - b.order)
            .slice(startIdx, startIdx + maxLimit);

        const blogIds = articleSlice.map(a => a.blog);

        const blogs = await Post.find({ _id: { $in: blogIds } })
            .select('blog_id title banner des tags activity publishedAt text_content post_type author')
            .populate('author', 'personal_info.fullname personal_info.username personal_info.profile_img');

        // Maintain order
        const blogMap = {};
        blogs.forEach(b => { blogMap[b._id.toString()] = b; });

        const orderedArticles = articleSlice
            .map(a => ({
                blog: blogMap[a.blog.toString()] || null,
                added_at: a.added_at,
                order: a.order
            }))
            .filter(a => a.blog !== null);

        return res.status(200).json({
            collection: {
                _id: collection._id,
                title: collection.title,
                description: collection.description,
                cover_image: collection.cover_image,
                slug: collection.slug,
                owner: collection.owner,
                publication: collection.publication,
                type: collection.type,
                visibility: collection.visibility,
                is_default: collection.is_default,
                total_articles: collection.total_articles,
                createdAt: collection.createdAt,
                is_owner: isOwner
            },
            articles: orderedArticles,
            totalDocs: collection.total_articles
        });

    } catch (err) {
        console.error('[Collection] getCollection failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/user-collections
 * Get a user's collections. Public only for non-owners.
 */
export const getUserCollections = async (req, res) => {
    try {
        const { username } = req.body;
        const user_id = req.user;

        // Need to resolve username to user ID
        const User = (await import('../Schema/User.js')).default;
        const targetUser = await User.findOne({ 'personal_info.username': username }).select('_id');
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        const isOwner = user_id && targetUser._id.toString() === user_id;

        // Auto-create default "Read Later" collection for owner
        if (isOwner) {
            await getOrCreateDefaultCollection(targetUser._id);
        }

        const query = { owner: targetUser._id, type: 'user' };
        if (!isOwner) {
            query.visibility = 'public';
        }

        const collections = await Collection.find(query)
            .select('title description cover_image slug visibility is_default total_articles articles createdAt')
            .sort({ is_default: -1, createdAt: -1 });

        // Attach first article banner as cover if no cover set
        const enriched = collections.map(col => {
            const obj = col.toObject();
            if (!obj.cover_image && obj.articles?.length > 0) {
                obj._has_articles = true;
            }
            delete obj.articles;
            return obj;
        });

        return res.status(200).json({ collections: enriched, is_owner: isOwner });

    } catch (err) {
        console.error('[Collection] getUserCollections failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/publication-collections
 */
export const getPublicationCollections = async (req, res) => {
    try {
        const { publication_id } = req.body;

        const collections = await Collection.find({ publication: publication_id, type: 'publication' })
            .select('title description cover_image slug visibility total_articles createdAt')
            .sort({ createdAt: -1 });

        return res.status(200).json({ collections });

    } catch (err) {
        console.error('[Collection] getPublicationCollections failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// ────────────────────────────────────────────────────────
// ARTICLE MANAGEMENT
// ────────────────────────────────────────────────────────

/**
 * POST /collection/add-article
 */
export const addArticle = async (req, res) => {
    try {
        const user_id = req.user;
        const { collection_id, blog_id } = req.body;

        if (!blog_id) return res.status(400).json({ error: "Blog ID is required" });

        const blog = await Post.findOne({ blog_id }).select('_id');
        if (!blog) return res.status(404).json({ error: "Blog not found" });

        const collection = await Collection.findById(collection_id);
        if (!collection) return res.status(404).json({ error: "Collection not found" });
        if (collection.owner.toString() !== user_id) {
            return res.status(403).json({ error: "You don't own this collection" });
        }

        // Atomic: only add if not already present
        const result = await Collection.findOneAndUpdate(
            { _id: collection_id, 'articles.blog': { $ne: blog._id } },
            { $push: { articles: { blog: blog._id, order: Date.now() } } },
            { new: true }
        );

        if (result) {
            // Sync total_articles
            await Collection.findByIdAndUpdate(collection_id, { total_articles: result.articles.length });
        }

        return res.status(200).json({ added: true });

    } catch (err) {
        console.error('[Collection] addArticle failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/remove-article
 */
export const removeArticle = async (req, res) => {
    try {
        const user_id = req.user;
        const { collection_id, blog_id } = req.body;

        const blog = await Post.findOne({ blog_id }).select('_id');
        if (!blog) return res.status(200).json({ removed: true });

        const collection = await Collection.findById(collection_id);
        if (!collection) return res.status(404).json({ error: "Collection not found" });
        if (collection.owner.toString() !== user_id) {
            return res.status(403).json({ error: "You don't own this collection" });
        }

        const result = await Collection.findByIdAndUpdate(collection_id, {
            $pull: { articles: { blog: blog._id } }
        }, { new: true });

        if (result) {
            await Collection.findByIdAndUpdate(collection_id, { total_articles: result.articles.length });
        }

        return res.status(200).json({ removed: true });

    } catch (err) {
        console.error('[Collection] removeArticle failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/reorder
 */
export const reorderArticles = async (req, res) => {
    try {
        const user_id = req.user;
        const { collection_id, article_order } = req.body;
        // article_order = [{ blog_id: ObjectId, order: Number }, ...]

        if (!collection_id || !Array.isArray(article_order)) {
            return res.status(400).json({ error: "collection_id and article_order array required" });
        }

        const collection = await Collection.findById(collection_id);
        if (!collection) return res.status(404).json({ error: "Collection not found" });
        if (collection.owner.toString() !== user_id) {
            return res.status(403).json({ error: "You don't own this collection" });
        }

        // Update order for each article
        for (const item of article_order) {
            const artIdx = collection.articles.findIndex(a => a.blog.toString() === item.blog_id);
            if (artIdx !== -1) {
                collection.articles[artIdx].order = item.order;
            }
        }

        await collection.save();
        return res.status(200).json({ reordered: true });

    } catch (err) {
        console.error('[Collection] reorderArticles failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/article-collections
 * Get which of MY collections contain this article (for Save modal checkboxes).
 */
export const getArticleCollections = async (req, res) => {
    try {
        const user_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) return res.status(400).json({ error: "Blog ID is required" });

        const blog = await Post.findOne({ blog_id }).select('_id');
        if (!blog) return res.status(200).json({ collections: [] });

        // Ensure default "Read Later" exists
        await getOrCreateDefaultCollection(user_id);

        // Get all user's collections, mark which ones contain this article
        const allCollections = await Collection.find({ owner: user_id, type: 'user' })
            .select('title slug visibility is_default total_articles articles')
            .sort({ is_default: -1, createdAt: -1 });

        const result = allCollections.map(col => ({
            _id: col._id,
            title: col.title,
            slug: col.slug,
            visibility: col.visibility,
            is_default: col.is_default,
            total_articles: col.total_articles,
            contains_article: col.articles.some(a => a.blog.toString() === blog._id.toString())
        }));

        return res.status(200).json({ collections: result });

    } catch (err) {
        console.error('[Collection] getArticleCollections failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/quick-save
 * Toggle save to "Read Later" collection (simple save button).
 */
export const quickSave = async (req, res) => {
    try {
        const user_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) return res.status(400).json({ error: "Blog ID is required" });

        const blog = await Post.findOne({ blog_id }).select('_id');
        if (!blog) return res.status(404).json({ error: "Blog not found" });

        const defaultCol = await getOrCreateDefaultCollection(user_id);

        // Atomic: try to pull the article first
        const pullResult = await Collection.findOneAndUpdate(
            { _id: defaultCol._id, 'articles.blog': blog._id },
            { $pull: { articles: { blog: blog._id } } },
            { new: true }
        );

        if (pullResult) {
            // Article was there and got removed
            await Collection.findByIdAndUpdate(defaultCol._id, { total_articles: pullResult.articles.length });
            return res.status(200).json({ saved: false });
        }

        // Article wasn't there — add it atomically (no duplicates possible)
        const pushResult = await Collection.findOneAndUpdate(
            { _id: defaultCol._id, 'articles.blog': { $ne: blog._id } },
            { $push: { articles: { blog: blog._id, order: Date.now() } } },
            { new: true }
        );

        if (pushResult) {
            await Collection.findByIdAndUpdate(defaultCol._id, { total_articles: pushResult.articles.length });
        }
        return res.status(200).json({ saved: true });

    } catch (err) {
        console.error('[Collection] quickSave failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /collection/is-saved
 * Check if article is in any of user's collections.
 */
export const isSaved = async (req, res) => {
    try {
        const user_id = req.user;
        const { blog_id } = req.body;

        if (!blog_id) return res.status(400).json({ error: "Blog ID is required" });

        const blog = await Post.findOne({ blog_id }).select('_id');
        if (!blog) return res.status(200).json({ saved: false });

        const found = await Collection.findOne({
            owner: user_id,
            'articles.blog': blog._id
        }).select('_id');

        return res.status(200).json({ saved: !!found });

    } catch (err) {
        console.error('[Collection] isSaved failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
