import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import validate from '../middleware/validate.js';
import { addCommentSchema, deleteCommentSchema } from '../validators/schemas.js';
import { addComment, getBlogComments, getReplies, deleteComment } from '../controllers/comment.controller.js';

const router = Router();

// Public
router.post("/get-blog-comments", asyncHandler(getBlogComments));
router.post("/get-replies", asyncHandler(getReplies));

// Protected
router.post("/add-comment", verifyJWT, validate(addCommentSchema), asyncHandler(addComment));
router.post("/delete-comment", verifyJWT, validate(deleteCommentSchema), asyncHandler(deleteComment));

export default router;
