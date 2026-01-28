import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  listBlacklist,
  getBlacklist,
  createBlacklist,
} from "../controllers/blacklist.controllers";

const router = Router();

/**
 * @openapi
 * /api/v1/blacklist:
 *   get:
 *     summary: List blacklist entries
 *     description: >
 *       Public blacklist feed. Supports search by name, phone, or entry id,
 *       and filter by risk level.
 *     tags: [Blacklist]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, or blacklist entry id
 *         example: "jessica"
 *       - in: query
 *         name: risk
 *         schema:
 *           type: string
 *           enum: [HIGH_RISK, SCAMMER, BANNED]
 *         description: Filter by risk level
 *         example: HIGH_RISK
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         example: 20
 *     responses:
 *       200:
 *         description: Blacklist entries
 */
router.get("/", listBlacklist);

/**
 * @openapi
 * /api/v1/blacklist/{id}:
 *   get:
 *     summary: Get a single blacklist entry
 *     tags: [Blacklist]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "7b9c1d8a-3c12-4bde-8caa-88d6c1f5b111"
 *     responses:
 *       200:
 *         description: Blacklist entry details
 *       404:
 *         description: Entry not found
 */
router.get("/:id", getBlacklist);

/**
 * @openapi
 * /api/v1/blacklist:
 *   post:
 *     summary: Submit a blacklist entry (provider only)
 *     description: >
 *       Providers can contribute by submitting a blacklist entry.
 *       At least phone or name must be provided.
 *     tags: [Blacklist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+2348012345678"
 *               name:
 *                 type: string
 *                 example: "John D"
 *               notes:
 *                 type: string
 *                 example: "Collected deposit and disappeared."
 *               evidenceUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - "https://example.com/evidence1.jpg"
 *                   - "https://example.com/evidence2.jpg"
 *           examples:
 *             phoneOnly:
 *               value:
 *                 phone: "+2348012345678"
 *                 notes: "Time waster"
 *             nameOnly:
 *               value:
 *                 name: "Precious Agu"
 *                 notes: "Scammer alert"
 *     responses:
 *       201:
 *         description: Blacklist entry created
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Providers only
 */
router.post("/", requireAuth, createBlacklist);

export default router;
