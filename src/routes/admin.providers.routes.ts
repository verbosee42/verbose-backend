import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/adminOnly";
import {
  listProviders,
  getProvider,
  approveProvider,
  rejectProvider,
} from "../controllers/admin.providers.controllers";

const router = Router();

/**
 * All admin routes require:
 * - Authentication
 * - ADMIN role
 */
router.use(requireAuth, requireAdmin);

/**
 * @openapi
 * /api/v1/admin/providers:
 *   get:
 *     summary: List providers (admin)
 *     description: >
 *       Returns a list of providers filtered by verification status.
 *       Used by admins to review pending provider onboarding.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter providers by verification status
 *         example: PENDING
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of providers
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get("/providers", listProviders);

/**
 * @openapi
 * /api/v1/admin/providers/{providerId}:
 *   get:
 *     summary: Get full provider details (admin)
 *     description: >
 *       Returns the full provider onboarding data including
 *       profile info, stats, services, rates, and uploaded media.
 *       This endpoint is ONLY for admin review.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: 7b9c1d8a-3c12-4bde-8caa-88d6c1f5b111
 *     responses:
 *       200:
 *         description: Provider details
 *       404:
 *         description: Provider not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get("/providers/:providerId", getProvider);

/**
 * @openapi
 * /api/v1/admin/providers/{providerId}/approve:
 *   post:
 *     summary: Approve provider verification
 *     description: >
 *       Approves a provider profile after successful verification.
 *       Once approved, the provider becomes eligible for subscription
 *       and public visibility.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 example: Verification passed. Clear images and valid ID.
 *     responses:
 *       200:
 *         description: Provider approved successfully
 *       404:
 *         description: Provider not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post("/providers/:providerId/approve", approveProvider);

/**
 * @openapi
 * /api/v1/admin/providers/{providerId}/reject:
 *   post:
 *     summary: Reject provider verification
 *     description: >
 *       Rejects a provider profile and records a rejection reason.
 *       The provider remains invisible until issues are resolved.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Verification selfie unclear. Please re-upload.
 *     responses:
 *       200:
 *         description: Provider rejected successfully
 *       400:
 *         description: Missing rejection reason
 *       404:
 *         description: Provider not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post("/providers/:providerId/reject", rejectProvider);

export default router;
