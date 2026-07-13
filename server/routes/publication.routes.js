import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { cacheResponse, invalidateCacheOnWrite } from '../middleware/cache.js';
import {
    createPublication,
    updatePublication,
    deletePublication,
    getPublication,
    getPublicationBlogs,
    getPublicationBlogsCount,
    getUserPublications,
    getMyPublications,
    addBlogToPublication,
    removeBlogFromPublication,
    subscribe,
    unsubscribe,
    isSubscribed,
    getMySubscriptions,
    getSubscriptionFeed,
    getSubscriptionFeedCount
} from '../controllers/publication.controller.js';

const router = Router();

// Public — anyone can view publications and their content (cached, non-personalized)
router.post("/publication/get", cacheResponse({ ttl: 300, tags: ['publications'] }), asyncHandler(getPublication));
router.post("/publication/blogs", cacheResponse({ ttl: 120, tags: ['publications'] }), asyncHandler(getPublicationBlogs));
router.post("/publication/blogs-count", cacheResponse({ ttl: 120, tags: ['publications'] }), asyncHandler(getPublicationBlogsCount));
router.post("/user-publications", cacheResponse({ ttl: 300, tags: ['publications'] }), asyncHandler(getUserPublications));

// Protected — structural writes invalidate the publications cache. (Subscribe/
// unsubscribe only shift a subscriber count, which is fine to let TTL refresh.)
router.post("/publication/create", verifyJWT, invalidateCacheOnWrite(['publications']), asyncHandler(createPublication));
router.post("/publication/update", verifyJWT, invalidateCacheOnWrite(['publications']), asyncHandler(updatePublication));
router.post("/publication/delete", verifyJWT, invalidateCacheOnWrite(['publications']), asyncHandler(deletePublication));
router.post("/publication/add-blog", verifyJWT, invalidateCacheOnWrite(['publications']), asyncHandler(addBlogToPublication));
router.post("/publication/remove-blog", verifyJWT, invalidateCacheOnWrite(['publications']), asyncHandler(removeBlogFromPublication));
router.post("/my-publications", verifyJWT, asyncHandler(getMyPublications));
router.post("/subscribe", verifyJWT, asyncHandler(subscribe));
router.post("/unsubscribe", verifyJWT, asyncHandler(unsubscribe));
router.post("/is-subscribed", verifyJWT, asyncHandler(isSubscribed));
router.post("/my-subscriptions", verifyJWT, asyncHandler(getMySubscriptions));
router.post("/subscription-feed", verifyJWT, asyncHandler(getSubscriptionFeed));
router.post("/subscription-feed-count", verifyJWT, asyncHandler(getSubscriptionFeedCount));

export default router;
