import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import { addCommentSchema, deleteCommentSchema } from '../validators/schemas.js';
import { addComment, getBlogComments, getReplies, deleteComment, getCommentThread, getPreviewReplies, likeComment, isCommentLiked } from '../controllers/comment.controller.js';

const router = Router();

// Public
router.post("/get-blog-comments", asyncHandler(getBlogComments));
router.post("/get-replies", asyncHandler(getReplies));
router.post("/get-comment-thread", asyncHandler(getCommentThread));
router.post("/get-preview-replies", asyncHandler(getPreviewReplies));

// Protected
router.post("/add-comment", verifyJWT, validate(addCommentSchema), asyncHandler(addComment));
router.post("/delete-comment", verifyJWT, validate(deleteCommentSchema), asyncHandler(deleteComment));
router.post("/like-comment", verifyJWT, asyncHandler(likeComment));
router.post("/is-comment-liked", verifyJWT, asyncHandler(isCommentLiked));

export default router;
