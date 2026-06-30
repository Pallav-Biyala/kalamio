import Blog from '../Schema/Blog.js';
import Post from '../Schema/Post.js';
import User from '../Schema/User.js';
import Publication from '../Schema/Publication.js';
import Notification from '../Schema/Notification.js';
import Comment from '../Schema/Comment.js';
import Collection from '../Schema/Collection.js';
import { nanoid } from 'nanoid';
import sanitizeHtml from 'sanitize-html';

const sanitizeOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'b', 'i', 'u', 'strong', 'em', 'ol', 'ul', 'li', 'code', 'pre', 'br', 'span', 'div', 'mark', 'table', 'tr', 'td', 'th', 'tbody', 'thead']),
    allowedAttributes: {
        '*': ['style', 'class'],
        'a': ['href', 'name', 'target'],
        'img': ['src', 'alt', 'title', 'width', 'height']
    }
};

// Recursively count words in Tiptap JSON nodes
const countWordsInTiptapNodes = (nodes) => {
    let words = 0;
    if (!Array.isArray(nodes)) return 0;
    for (const node of nodes) {
        if (node.type === 'text' && node.text) {
            words += node.text.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
        }
        if (node.content) {
            words += countWordsInTiptapNodes(node.content);
        }
    }
    return words;
};

// Calculate read time from content (supports both EditorJS and Tiptap formats)
const calculateReadTime = (content, title = '', des = '') => {
    let totalWords = 0;
    if (title) totalWords += title.split(/\s+/).filter(Boolean).length;
    if (des) totalWords += des.split(/\s+/).filter(Boolean).length;

    // Tiptap JSON format
    if (content && content.type === 'doc' && Array.isArray(content.content)) {
        totalWords += countWordsInTiptapNodes(content.content);
    }
    // Legacy EditorJS format
    else if (content && content.blocks) {
        content.blocks.forEach(block => {
            let text = '';
            if (block.data) {
                if (block.data.text) text = block.data.text;
                if (block.data.caption) text += ' ' + block.data.caption;
                if (block.data.items) {
                    text += ' ' + (Array.isArray(block.data.items) ? block.data.items.join(' ') : '');
                }
                if (block.data.code) text += ' ' + block.data.code;
            }
            text = text.replace(/<[^>]*>/g, ' ');
            totalWords += text.split(/\s+/).filter(Boolean).length;
        });
    }

    return Math.max(1, Math.ceil(totalWords / 200));
};

// Sanitize Tiptap JSON nodes recursively
const sanitizeTiptapNodes = (nodes) => {
    if (!Array.isArray(nodes)) return nodes;
    return nodes.map(node => {
        if (node.type === 'text' && node.text) {
            node.text = sanitizeHtml(node.text, sanitizeOptions);
        }
        if (node.content) {
            node.content = sanitizeTiptapNodes(node.content);
        }
        if (node.marks) {
            node.marks = node.marks.map(mark => {
                if (mark.type === 'link' && mark.attrs && mark.attrs.href) {
                    const href = mark.attrs.href;
                    if (/^(javascript|data):/i.test(href.trim())) {
                        mark.attrs.href = '#';
                    }
                }
                return mark;
            });
        }
        if (node.type === 'embed' && node.attrs && node.attrs.url) {
            const embedUrl = node.attrs.url;
            if (/^(javascript|data):/i.test(embedUrl.trim())) {
                node.attrs.url = '';
            }
        }
        return node;
    });
};

// Create or update a blog post
export const createBlog = (req, res) => {

    let authorId = req.user;

    let { title, banner, content, des, tags, draft, id, publication } = req.body;

    // Sanitize basic strings
    title = title ? sanitizeHtml(title, sanitizeOptions) : '';
    des = des ? sanitizeHtml(des, sanitizeOptions) : '';
    tags = tags ? tags.map(tag => sanitizeHtml(tag, sanitizeOptions)) : [];

    // Sanitize content (supports both Tiptap and EditorJS formats)
    if (content) {
        if (content.type === 'doc' && Array.isArray(content.content)) {
            // Tiptap JSON format
            content.content = sanitizeTiptapNodes(content.content);
        } else if (content.blocks) {
            // Legacy EditorJS format
            content.blocks = content.blocks.map(block => {
                if (block.data && block.data.text) {
                    block.data.text = sanitizeHtml(block.data.text, sanitizeOptions);
                }
                if (block.data && block.data.items) {
                    block.data.items = block.data.items.map(item => sanitizeHtml(item, sanitizeOptions));
                }
                return block;
            });
        }
    }

    // ── Validation ────────────────────────────────
    if(!title.length){
        return res.status(403).json({ error: "You must provide a title" });
    }

    if(!draft){
        if(!des.length || des.length > 200){
            return res.status(403).json({ error: "You must provide blog description under 200 characters" });
        }
        if(!banner.length){
            return res.status(403).json({ error: "You must provide blog banner to publish it" });
        }
        const hasContent = content?.type === 'doc'
            ? (content.content && content.content.length > 0)
            : (content?.blocks && content.blocks.length > 0);
        if(!hasContent){
            return res.status(403).json({ error: "There must be some blog content to publish it" });
        }
        if(!tags.length || tags.length > 10){
            return res.status(403).json({ error: "Provide tags to publish the blog, maximum 10" });
        }
    }

    tags = tags.map(tag => tag.toLowerCase());

    // Generate blog_id
    let blog_id = id || (title.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, "-").trim() + nanoid());

    if(id){

        Blog.findOne({ blog_id, author: authorId })
        .then(async existingBlog => {
            if (!existingBlog) return res.status(403).json({ error: "You don't have permission to edit this blog" });

            if (!existingBlog.draft && draft) {
                return res.status(403).json({ error: "Published posts can't be moved back to drafts" });
            }

            const shouldBeDraft = existingBlog.draft ? Boolean(draft) : false;

            let updateData = {
                title, des, banner, content, tags,
                draft: shouldBeDraft,
                readTime: calculateReadTime(content, title, des),
                edited: true
            };

            // If publishing a draft, update publishedAt to now
            if (existingBlog.draft && !shouldBeDraft) {
                updateData.publishedAt = new Date();
            }

            // Handle publication change on update
            if (publication !== undefined) {
                updateData.publication = publication || null;
            }

            const blog = await Blog.findOneAndUpdate({ blog_id, author: authorId }, updateData);
            if (!blog) return res.status(403).json({ error: "You don't have permission to edit this blog" });

            // If publication changed, update counters
            const oldPubId = existingBlog.publication?.toString() || null;
            const newPubId = (publication || null)?.toString?.() || publication || null;

            if (oldPubId !== newPubId) {
                if (oldPubId) {
                    await Publication.findByIdAndUpdate(oldPubId, { $inc: { total_posts: -1 } });
                }
                if (newPubId) {
                    await Publication.findByIdAndUpdate(newPubId, { $inc: { total_posts: 1 } });
                }
            }

            return res.status(200).json({ id: blog_id });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })

    } else{
        
        let blog = new Blog({
            title, des, banner, content, tags, author: authorId, blog_id,
            draft: Boolean(draft),
            readTime: calculateReadTime(content, title, des),
            publication: publication || undefined,
        })

        blog.save().then(async blog => {

        let incrementVal = draft ? 0 : 1;

        // If blog is linked to a publication, increment its post count
        if (publication && !draft) {
            await Publication.findByIdAndUpdate(publication, { $inc: { total_posts: 1 } }).catch(() => {});
        }

        User.findOneAndUpdate({ _id: authorId }, { $inc : { "account_info.total_posts" : incrementVal }, $push : { "blogs": blog._id } })
        .then(user => {
            return res.status(200).json({ id: blog.blog_id })
        })
        .catch(err => {
            return res.status(500).json({ error: "Failed to update total posts number" })
        })

        })
        .catch(err => {
            return res.status(500).json({ error: err.message })
        })

    }

};

// Bulk delete blogs (with ownership check and cascading cleanup)
export const bulkDeleteBlogs = async (req, res) => {

    let user_id = req.user;
    let { blog_ids } = req.body;

    if (!blog_ids || !Array.isArray(blog_ids) || blog_ids.length === 0) {
        return res.status(400).json({ error: "blog_ids must be a non-empty array" });
    }

    // Find only posts owned by this user
    const posts = await Post.find({ blog_id: { $in: blog_ids }, author: user_id }).select('_id');
    const post_ids = posts.map(p => p._id);

    if (post_ids.length === 0) {
        return res.status(200).json({ deleted_count: 0 });
    }

    // Cascade delete all related data in parallel
    await Promise.all([
        Comment.deleteMany({ blog_id: { $in: post_ids } }),
        Notification.deleteMany({ blog: { $in: post_ids } }),
        Collection.updateMany(
            { 'articles.blog': { $in: post_ids } },
            { $pull: { articles: { blog: { $in: post_ids } } }, $inc: { total_articles: -1 } }
        ),
        Post.deleteMany({ _id: { $in: post_ids } })
    ]);

    // Update user: decrement total_posts and remove blog refs
    await User.findOneAndUpdate(
        { _id: user_id },
        {
            $inc: { "account_info.total_posts": -post_ids.length },
            $pull: { blogs: { $in: post_ids } }
        }
    );

    return res.status(200).json({ deleted_count: post_ids.length });

};
