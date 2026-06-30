import { Router } from 'express';
import { verifyJWT, optionalJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import {
    createCollection, updateCollection, deleteCollection, getCollection,
    getUserCollections, getPublicationCollections,
    addArticle, removeArticle, reorderArticles,
    getArticleCollections, quickSave, isSaved
} from '../controllers/collection.controller.js';

const router = Router();

// CRUD
router.post('/collection/create', verifyJWT, asyncHandler(createCollection));
router.post('/collection/update', verifyJWT, asyncHandler(updateCollection));
router.post('/collection/delete', verifyJWT, asyncHandler(deleteCollection));
router.post('/collection/get', optionalJWT, asyncHandler(getCollection));

// Listing
router.post('/collection/user-collections', optionalJWT, asyncHandler(getUserCollections));
router.post('/collection/publication-collections', asyncHandler(getPublicationCollections));

// Article management
router.post('/collection/add-article', verifyJWT, asyncHandler(addArticle));
router.post('/collection/remove-article', verifyJWT, asyncHandler(removeArticle));
router.post('/collection/reorder', verifyJWT, asyncHandler(reorderArticles));

// Save helpers
router.post('/collection/article-collections', verifyJWT, asyncHandler(getArticleCollections));
router.post('/collection/quick-save', verifyJWT, asyncHandler(quickSave));
router.post('/collection/is-saved', verifyJWT, asyncHandler(isSaved));

export default router;
