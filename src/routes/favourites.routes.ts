import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from "../controllers/favourites.controllers";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/v1/favorites:
 *   get:
 *     summary: List my favorite providers
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favorites list
 *       401:
 *         description: Unauthorized
 */
router.get("/", listFavorites);

/**
 * @openapi
 * /api/v1/favorites/{providerId}:
 *   post:
 *     summary: Add a provider to favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "7b9c1d8a-3c12-4bde-8caa-88d6c1f5b111"
 *     responses:
 *       201:
 *         description: Added to favorites
 *       404:
 *         description: Provider not found
 *       401:
 *         description: Unauthorized
 */
router.post("/:providerId", addFavorite);

/**
 * @openapi
 * /api/v1/favorites/{providerId}:
 *   delete:
 *     summary: Remove a provider from favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "7b9c1d8a-3c12-4bde-8caa-88d6c1f5b111"
 *     responses:
 *       200:
 *         description: Removed from favorites
 *       401:
 *         description: Unauthorized
 */
router.delete("/:providerId", removeFavorite);

export default router;
