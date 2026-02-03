import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  addComment,
  createFeedPost,
  getFeedPost,
  likePost,
  listComments,
  listFeed,
  unlikePost,
} from "../controllers/feeds.controllers";

const router = Router();

/**
 * @openapi
 * /api/v1/feeds:
 *   get:
 *     summary: List feed posts (public)
 *     tags: [Feeds]
 */
router.get("/", listFeed);

/**
 * @openapi
 * /api/v1/feeds:
 *   post:
 *     summary: Create a feed post (provider only)
 *     tags: [Feeds]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", requireAuth, createFeedPost);

/**
 * @openapi
 * /api/v1/feeds/{postId}:
 *   get:
 *     summary: Get a single feed post
 *     tags: [Feeds]
 */
router.get("/:postId", getFeedPost);

/**
 * @openapi
 * /api/v1/feeds/{postId}/like:
 *   post:
 *     summary: Like a feed post
 *     tags: [Feeds]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:postId/like", requireAuth, likePost);

/**
 * @openapi
 * /api/v1/feeds/{postId}/like:
 *   delete:
 *     summary: Unlike a feed post
 *     tags: [Feeds]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:postId/like", requireAuth, unlikePost);

/**
 * @openapi
 * /api/v1/feeds/{postId}/comments:
 *   get:
 *     summary: List comments for a feed post
 *     tags: [Feeds]
 */
router.get("/:postId/comments", listComments);

/**
 * @openapi
 * /api/v1/feeds/{postId}/comments:
 *   post:
 *     summary: Add a comment to a feed post
 *     tags: [Feeds]
 *     security:
 *       - bearerAuth: []
 */
router.post("/:postId/comments", requireAuth, addComment);

export default router;
