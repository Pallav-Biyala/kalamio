import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
import asyncHandler from '../middleware/asyncHandler.js';
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

// Public — anyone can view publications and their content
router.post("/publication/get", asyncHandler(getPublication));
router.post("/publication/blogs", asyncHandler(getPublicationBlogs));
router.post("/publication/blogs-count", asyncHandler(getPublicationBlogsCount));
router.post("/user-publications", asyncHandler(getUserPublications));

// Protected — requires authentication
router.post("/publication/create", verifyJWT, asyncHandler(createPublication));
router.post("/publication/update", verifyJWT, asyncHandler(updatePublication));
router.post("/publication/delete", verifyJWT, asyncHandler(deletePublication));
router.post("/publication/add-blog", verifyJWT, asyncHandler(addBlogToPublication));
router.post("/publication/remove-blog", verifyJWT, asyncHandler(removeBlogFromPublication));
router.post("/my-publications", verifyJWT, asyncHandler(getMyPublications));
router.post("/subscribe", verifyJWT, asyncHandler(subscribe));
router.post("/unsubscribe", verifyJWT, asyncHandler(unsubscribe));
router.post("/is-subscribed", verifyJWT, asyncHandler(isSubscribed));
router.post("/my-subscriptions", verifyJWT, asyncHandler(getMySubscriptions));
router.post("/subscription-feed", verifyJWT, asyncHandler(getSubscriptionFeed));
router.post("/subscription-feed-count", verifyJWT, asyncHandler(getSubscriptionFeedCount));

export default router;
