import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import { invalidateCacheOnWrite } from '../middleware/cache.js';
import { addCommentSchema, deleteCommentSchema } from '../validators/schemas.js';
import { addComment, getBlogComments, getReplies, deleteComment, getCommentThread, getPreviewReplies, likeComment, isCommentLiked } from '../controllers/comment.controller.js';

const router = Router();

// Public
router.post("/get-blog-comments", asyncHandler(getBlogComments));
router.post("/get-replies", asyncHandler(getReplies));
router.post("/get-comment-thread", asyncHandler(getCommentThread));
router.post("/get-preview-replies", asyncHandler(getPreviewReplies));

// Protected
// Comment add/delete change activity.total_comments, which cached feed cards render — invalidate
// the narrow 'feed' tag (only /latest-blogs keys) so the count is fresh on the next feed request
// without flushing trending/search. Same stale-cache bug as likes (see blog.routes.js).
// like-comment is deliberately untouched: comment likes surface only in uncached endpoints.
router.post("/add-comment", verifyJWT, validate(addCommentSchema), invalidateCacheOnWrite(['feed']), asyncHandler(addComment));
router.post("/delete-comment", verifyJWT, validate(deleteCommentSchema), invalidateCacheOnWrite(['feed']), asyncHandler(deleteComment));
router.post("/like-comment", verifyJWT, asyncHandler(likeComment));
router.post("/is-comment-liked", verifyJWT, asyncHandler(isCommentLiked));

export default router;
