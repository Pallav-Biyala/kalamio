import mongoose from 'mongoose';
import Post from '../Schema/Post.js';
import User from '../Schema/User.js';
import Follow from '../Schema/Follow.js';

/**
 * POST /api/v1/analytics/overview
 * Get aggregated analytics overview for the logged-in user.
 */
export const getAnalyticsOverview = async (req, res) => {
    try {
        const user_id = req.user;

        // Fetch user account stats
        const user = await User.findById(user_id).select('account_info');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { total_posts, total_reads, total_followers, total_following } = user.account_info;

        // Aggregate likes and comments across all published posts
        const engagementStats = await Post.aggregate([
            { $match: { author: new mongoose.Types.ObjectId(user_id), draft: false } },
            { $group: { _id: null, total_likes: { $sum: '$activity.total_likes' }, total_comments: { $sum: '$activity.total_comments' } } }
        ]);

        const total_likes = engagementStats.length ? engagementStats[0].total_likes : 0;
        const total_comments = engagementStats.length ? engagementStats[0].total_comments : 0;

        return res.status(200).json({
            total_posts,
            total_reads,
            total_followers,
            total_likes,
            total_comments
        });

    } catch (err) {
        console.error('[Analytics] getAnalyticsOverview failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/analytics/top-posts
 * Get top 10 posts by total reads for the logged-in user.
 */
export const getTopPosts = async (req, res) => {
    try {
        const user_id = req.user;

        const posts = await Post.find({ author: user_id, draft: false })
            .sort({ 'activity.total_reads': -1 })
            .limit(10)
            .select('blog_id title text_content type publishedAt activity');

        return res.status(200).json({ posts });

    } catch (err) {
        console.error('[Analytics] getTopPosts failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};

/**
 * POST /api/v1/analytics/follower-growth
 * Get follower growth data for the last 6 months, grouped by month.
 */
export const getFollowerGrowth = async (req, res) => {
    try {
        const user_id = req.user;

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const growth = await Follow.aggregate([
            { $match: { following: new mongoose.Types.ObjectId(user_id), followedAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$followedAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        return res.status(200).json({
            growth: growth.map(g => ({ month: g._id, count: g.count }))
        });

    } catch (err) {
        console.error('[Analytics] getFollowerGrowth failed:', err.message);
        return res.status(500).json({ error: err.message });
    }
};
