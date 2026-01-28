import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/adminOnly";
import { verifyBlacklistEntry } from "../controllers/admin.blacklist.controllers";

const router = Router();

router.use(requireAuth, requireAdmin);

/**
 * @openapi
 * /api/v1/admin/blacklist/{entryId}/verify:
 *   post:
 *     summary: Verify a blacklist entry (admin only)
 *     description: >
 *       Adds a verification record for the blacklist entry. Used to power
 *       "Verified by X admin(s)" on the blacklist UI.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "7b9c1d8a-3c12-4bde-8caa-88d6c1f5b111"
 *     responses:
 *       200:
 *         description: Verification recorded
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 *       404:
 *         description: Blacklist entry not found
 */
router.post("/blacklist/:entryId/verify", verifyBlacklistEntry);

export default router;
