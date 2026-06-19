import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    addBookmark,
    removeBookmark,
    getBookmarks,
    isBookmarked,
    getBookmarksCount
} from '../controllers/bookmark.controller.js';

const router = Router();

// Protected — all bookmark routes require authentication
router.post("/bookmark", verifyJWT, asyncHandler(addBookmark));
router.post("/remove-bookmark", verifyJWT, asyncHandler(removeBookmark));
router.post("/bookmarks", verifyJWT, asyncHandler(getBookmarks));
router.post("/is-bookmarked", verifyJWT, asyncHandler(isBookmarked));
router.post("/bookmarks-count", verifyJWT, asyncHandler(getBookmarksCount));

export default router;
