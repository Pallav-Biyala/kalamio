import TextPost from '../Schema/TextPost.js';
import PollVote from '../Schema/PollVote.js';
import User from '../Schema/User.js';
import Notification from '../Schema/Notification.js';
import Publication from '../Schema/Publication.js';
import { nanoid } from 'nanoid';
import sanitizeHtml from 'sanitize-html';

// Create or update a text post
export const createTextPost = (req, res) => {

    let authorId = req.user;

    let { text_content, images, poll, draft, id, publication } = req.body;

    // Sanitize text content (strip all HTML)
    text_content = text_content ? sanitizeHtml(text_content, { allowedTags: [], allowedAttributes: {} }) : '';

    // ── Validation ────────────────────────────────
    if (!text_content || !text_content.trim().length) {
        return res.status(403).json({ error: "Text post cannot be empty" });
    }
    if (text_content.length > 9999) {
        return res.status(403).json({ error: "Text post cannot exceed 9,999 characters" });
    }
    if (images && images.length > 4) {
        return res.status(403).json({ error: "Maximum 4 images per text post" });
    }

    // Sanitize poll
    if (poll && poll.options) {
        if (poll.options.length < 2) {
            return res.status(403).json({ error: "Poll must have at least 2 options" });
        }
        if (poll.options.length > 6) {
            return res.status(403).json({ error: "Poll cannot have more than 6 options" });
        }
        poll.options = poll.options.map(opt => ({
            text: sanitizeHtml(opt.text || '', { allowedTags: [], allowedAttributes: {} }),
            votes: 0
        }));
        poll.total_votes = 0;
        poll.question = poll.question ? sanitizeHtml(poll.question, { allowedTags: [], allowedAttributes: {} }) : '';
    }

    // Generate blog_id
    let blog_id = id || ('tp-' + nanoid());

    if(id){

        TextPost.findOne({ blog_id, author: authorId })
        .then(async existingPost => {
            if (!existingPost) return res.status(403).json({ error: "You don't have permission to edit this post" });

            if (!existingPost.draft && draft) {
                return res.status(403).json({ error: "Published posts can't be moved back to drafts" });
            }

            const shouldBeDraft = existingPost.draft ? Boolean(draft) : false;

            let updateData = {
                text_content,
                images: images || [],
                poll: poll || undefined,
                draft: shouldBeDraft,
                edited: true
            };

            // If publishing a draft, update publishedAt to now
            if (existingPost.draft && !shouldBeDraft) {
                updateData.publishedAt = new Date();
            }

            // Handle publication change on update
            if (publication !== undefined) {
                updateData.publication = publication || null;
            }

            const post = await TextPost.findOneAndUpdate({ blog_id, author: authorId }, updateData);
            if (!post) return res.status(403).json({ error: "You don't have permission to edit this post" });

            // If publication changed, text posts no longer update total_posts
            const oldPubId = existingPost.publication?.toString() || null;
            const newPubId = (publication || null)?.toString?.() || publication || null;

            return res.status(200).json({ id: blog_id });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })

    } else{
        
        let post = new TextPost({
            text_content,
            images: images || [],
            poll: poll || undefined,
            author: authorId,
            blog_id,
            draft: Boolean(draft),
            publication: publication || undefined,
        })

        post.save().then(async post => {

        // If post is linked to a publication, no longer increment its post count for text posts

        User.findOneAndUpdate({ _id: authorId }, { $push : { "blogs": post._id } })
        .then(user => {
            // Process mentions for text posts if not draft
            if (text_content && !draft) {
                const mentionRegex = /@([\w](?:[\w.]*[\w])?)/g;
                const mentions = [...text_content.matchAll(mentionRegex)].map(m => m[1]);
                const uniqueUsernames = [...new Set(mentions)];
                
                console.log('[Mention] Detected usernames:', uniqueUsernames);
                
                if (uniqueUsernames.length > 0) {
                    User.find({ "personal_info.username": { $in: uniqueUsernames } })
                        .select("_id personal_info.username")
                        .then(async users => {
                            console.log('[Mention] Found users:', users.map(u => ({ id: u._id, username: u.personal_info.username })));
                            console.log('[Mention] Author ID:', authorId);
                            for (let u of users) {
                                if (u._id.toString() === authorId.toString()) {
                                    console.log('[Mention] Skipping self-mention for:', u.personal_info.username);
                                    continue;
                                }
                                try {
                                    const exists = await Notification.exists({ type: "mention", blog: post._id, notification_for: u._id });
                                    if (!exists) {
                                        await new Notification({
                                            type: "mention",
                                            blog: post._id,
                                            notification_for: u._id,
                                            user: authorId
                                        }).save();
                                        console.log('[Mention] ✅ Notification created for:', u.personal_info.username);
                                    } else {
                                        console.log('[Mention] Notification already exists for:', u.personal_info.username);
                                    }
                                } catch (err) {
                                    console.error('[Mention] ❌ Failed to create notification for:', u.personal_info.username, err.message);
                                }
                            }
                        })
                        .catch(err => console.error("[Mention] ❌ User lookup error:", err.message));
                }
            }

            return res.status(200).json({ id: post.blog_id })
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

// Vote on a poll option in a text post
export const votePoll = (req, res) => {
    const user_id = req.user;
    const { blog_id, option_index } = req.body;

    if (blog_id === undefined || option_index === undefined) {
        return res.status(400).json({ error: "blog_id and option_index are required" });
    }

    // Check if user already voted
    PollVote.findOne({ blog_id, user: user_id })
    .then(existingVote => {
        if (existingVote) {
            return res.status(400).json({ error: "You have already voted on this poll" });
        }

        TextPost.findOne({ blog_id })
        .then(post => {
            if (!post) return res.status(404).json({ error: "Text post not found" });
            if (!post.poll || !post.poll.options || !post.poll.options.length) {
                return res.status(400).json({ error: "This post has no poll" });
            }
            if (option_index < 0 || option_index >= post.poll.options.length) {
                return res.status(400).json({ error: "Invalid option index" });
            }

            post.poll.options[option_index].votes += 1;
            post.poll.total_votes += 1;
            post.markModified('poll');

            // Save vote record and post in parallel
            Promise.all([
                post.save(),
                new PollVote({ blog_id, user: user_id, option_index }).save()
            ])
            .then(([updated]) => {
                return res.status(200).json({ poll: updated.poll, voted_option: option_index });
            })
            .catch(err => res.status(500).json({ error: err.message }));
        })
        .catch(err => res.status(500).json({ error: err.message }));
    })
    .catch(err => res.status(500).json({ error: err.message }));
};

// Check if user has voted on a poll
export const checkPollVote = (req, res) => {
    const user_id = req.user;
    const { blog_id } = req.body;

    if (!blog_id) {
        return res.status(400).json({ error: "blog_id is required" });
    }

    PollVote.findOne({ blog_id, user: user_id })
    .then(vote => {
        if (vote) {
            return res.status(200).json({ hasVoted: true, option_index: vote.option_index });
        }
        return res.status(200).json({ hasVoted: false });
    })
    .catch(err => res.status(500).json({ error: err.message }));
};
