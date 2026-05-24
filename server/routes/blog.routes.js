import { Router } from 'express';
import express from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    latestBlogs,
    allLatestBlogsCount,
    trendingBlogs,
    searchBlogs,
    searchBlogsCount,
    createBlog,
    getBlog,
    likeBlog,
    isLikedByUser,
    userWrittenBlogs,
    userWrittenBlogsCount,
    deleteBlog,
    batchIsLiked
} from '../controllers/blog.controller.js';

const router = Router();

// Larger body limit for blog content (editor data can be large)
const largeBody = express.json({ limit: '10mb' });

// Public
router.post("/latest-blogs", asyncHandler(latestBlogs));
router.post("/all-latest-blogs-count", asyncHandler(allLatestBlogsCount));
router.get("/trending-blogs", asyncHandler(trendingBlogs));
router.post("/search-blogs", asyncHandler(searchBlogs));
router.post("/search-blogs-count", asyncHandler(searchBlogsCount));
router.post("/get-blog", asyncHandler(getBlog));

// Protected — create-blog gets a larger body limit for editor content
router.post("/create-blog", verifyJWT, largeBody, asyncHandler(createBlog));
router.post("/like-blog", verifyJWT, asyncHandler(likeBlog));
router.post("/isliked-by-user", verifyJWT, asyncHandler(isLikedByUser));
router.post("/user-written-blogs", verifyJWT, asyncHandler(userWrittenBlogs));
router.post("/user-written-blogs-count", verifyJWT, asyncHandler(userWrittenBlogsCount));
router.post("/delete-blog", verifyJWT, asyncHandler(deleteBlog));
router.post("/batch-isliked", verifyJWT, asyncHandler(batchIsLiked));

export default router;
