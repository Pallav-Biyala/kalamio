import { Router } from 'express';
import express from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import { cacheResponse, invalidateCacheOnWrite } from '../middleware/cache.js';
import { getBlogSchema, likeBlogSchema, deleteBlogSchema } from '../validators/schemas.js';

// Shared post handlers (unified feed, interactions, etc.)
import {
    latestPosts,
    allLatestPostsCount,
    trendingPosts,
    searchPosts,
    searchPostsCount,
    getPost,
    likePost,
    isLikedByUser,
    userWrittenPosts,
    userWrittenPostsCount,
    deletePost,
    batchIsLiked
} from '../controllers/post.controller.js';

// Blog-specific handlers
import { createBlog, bulkDeleteBlogs } from '../controllers/blog.controller.js';

// Text post-specific handlers
import { createTextPost, votePoll, checkPollVote, getPollVoters } from '../controllers/textpost.controller.js';

const router = Router();

// Larger body limit for blog content (editor data can be large)
const largeBody = express.json({ limit: '10mb' });

// ── Public (feed & read) ────────────────────────────────────────────
// These are public + non-personalized, so responses are cached in Redis with a
// short TTL. Trending is an expensive aggregation that changes slowly (longer
// TTL); feeds/counts use shorter TTLs to stay fresh. Caching no-ops if Redis is
// unconfigured/unreachable.
router.post("/latest-blogs", cacheResponse({ ttl: 60, tags: ['blogs'] }), asyncHandler(latestPosts));
router.post("/all-latest-blogs-count", cacheResponse({ ttl: 120, tags: ['blogs'] }), asyncHandler(allLatestPostsCount));
router.get("/trending-blogs", cacheResponse({ ttl: 300, tags: ['blogs'] }), asyncHandler(trendingPosts));
router.post("/search-blogs", cacheResponse({ ttl: 120, tags: ['blogs'] }), asyncHandler(searchPosts));
router.post("/search-blogs-count", cacheResponse({ ttl: 120, tags: ['blogs'] }), asyncHandler(searchPostsCount));
router.post("/get-blog", validate(getBlogSchema), asyncHandler(getPost));

// Publishing/deleting a post invalidates the 'blogs' cache. Draft autosaves are
// skipped — they don't reach public feeds, so invalidating on them would thrash.
const skipDrafts = { unless: (req) => req.body?.draft === true };

// ── Protected — type-specific create ────────────────────────────────
// A post inside a publication also invalidates the publications cache.
const blogWriteTags = (req) => (req.body?.publication ? ['blogs', 'publications'] : ['blogs']);
router.post("/create-blog", verifyJWT, largeBody, invalidateCacheOnWrite(blogWriteTags, skipDrafts), asyncHandler(createBlog));
router.post("/create-text-post", verifyJWT, invalidateCacheOnWrite(['blogs'], skipDrafts), asyncHandler(createTextPost));

// ── Protected — interactions (type-agnostic) ────────────────────────
router.post("/like-blog", verifyJWT, validate(likeBlogSchema), asyncHandler(likePost));
router.post("/isliked-by-user", verifyJWT, asyncHandler(isLikedByUser));
router.post("/batch-isliked", verifyJWT, asyncHandler(batchIsLiked));

// ── Protected — user dashboard ──────────────────────────────────────
router.post("/user-written-blogs", verifyJWT, asyncHandler(userWrittenPosts));
router.post("/user-written-blogs-count", verifyJWT, asyncHandler(userWrittenPostsCount));
router.post("/delete-blog", verifyJWT, validate(deleteBlogSchema), invalidateCacheOnWrite(['blogs', 'publications']), asyncHandler(deletePost));
router.post("/bulk-delete-blogs", verifyJWT, invalidateCacheOnWrite(['blogs', 'publications']), asyncHandler(bulkDeleteBlogs));

// ── Protected — text post polls ─────────────────────────────────────
router.post("/vote-poll", verifyJWT, asyncHandler(votePoll));
router.post("/check-poll-vote", verifyJWT, asyncHandler(checkPollVote));
router.post("/poll-voters", verifyJWT, asyncHandler(getPollVoters));

export default router;
