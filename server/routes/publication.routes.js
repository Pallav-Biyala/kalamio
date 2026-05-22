import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.js';
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
    getMySubscriptions
} from '../controllers/publication.controller.js';

const router = Router();

// Public — anyone can view publications and their content
router.post("/publication/get", getPublication);
router.post("/publication/blogs", getPublicationBlogs);
router.post("/publication/blogs-count", getPublicationBlogsCount);
router.post("/user-publications", getUserPublications);

// Protected — requires authentication
router.post("/publication/create", verifyJWT, createPublication);
router.post("/publication/update", verifyJWT, updatePublication);
router.post("/publication/delete", verifyJWT, deletePublication);
router.post("/publication/add-blog", verifyJWT, addBlogToPublication);
router.post("/publication/remove-blog", verifyJWT, removeBlogFromPublication);
router.post("/my-publications", verifyJWT, getMyPublications);
router.post("/subscribe", verifyJWT, subscribe);
router.post("/unsubscribe", verifyJWT, unsubscribe);
router.post("/is-subscribed", verifyJWT, isSubscribed);
router.post("/my-subscriptions", verifyJWT, getMySubscriptions);

export default router;
