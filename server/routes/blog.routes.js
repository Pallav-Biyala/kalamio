import { Router } from 'express';
import express from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
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
import { createTextPost, votePoll, checkPollVote } from '../controllers/textpost.controller.js';

const router = Router();

// Larger body limit for blog content (editor data can be large)
const largeBody = express.json({ limit: '10mb' });

// ── Public (feed & read) ────────────────────────────────────────────
router.post("/latest-blogs", asyncHandler(latestPosts));
router.post("/all-latest-blogs-count", asyncHandler(allLatestPostsCount));
router.get("/trending-blogs", asyncHandler(trendingPosts));
router.post("/search-blogs", asyncHandler(searchPosts));
router.post("/search-blogs-count", asyncHandler(searchPostsCount));
router.post("/get-blog", validate(getBlogSchema), asyncHandler(getPost));

// ── Protected — type-specific create ────────────────────────────────
router.post("/create-blog", verifyJWT, largeBody, asyncHandler(createBlog));
router.post("/create-text-post", verifyJWT, asyncHandler(createTextPost));

// ── Protected — interactions (type-agnostic) ────────────────────────
router.post("/like-blog", verifyJWT, validate(likeBlogSchema), asyncHandler(likePost));
router.post("/isliked-by-user", verifyJWT, asyncHandler(isLikedByUser));
router.post("/batch-isliked", verifyJWT, asyncHandler(batchIsLiked));

// ── Protected — user dashboard ──────────────────────────────────────
router.post("/user-written-blogs", verifyJWT, asyncHandler(userWrittenPosts));
router.post("/user-written-blogs-count", verifyJWT, asyncHandler(userWrittenPostsCount));
router.post("/delete-blog", verifyJWT, validate(deleteBlogSchema), asyncHandler(deletePost));
router.post("/bulk-delete-blogs", verifyJWT, asyncHandler(bulkDeleteBlogs));

// ── Protected — text post polls ─────────────────────────────────────
router.post("/vote-poll", verifyJWT, asyncHandler(votePoll));
router.post("/check-poll-vote", verifyJWT, asyncHandler(checkPollVote));

export default router;
