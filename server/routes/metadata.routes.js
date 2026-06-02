import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { fetchUrlMetadata } from '../controllers/metadata.controller.js';

const router = Router();

router.post('/url-metadata', asyncHandler(fetchUrlMetadata));

export default router;
