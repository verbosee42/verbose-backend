import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  getMyProfile,
  getMyMedia,
  updateMyProfile,
} from "../controllers/providers.controllers";

const router = Router();

/**
 * @openapi
 * /api/v1/providers/me:
 *   get:
 *     summary: Get my provider profile (full)
 *     description: >
 *       Returns the authenticated provider's user info, provider profile,
 *       and all media (cover, avatar, gallery).
 *       Provider-only route.
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Provider profile with media
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid, example: "694d041e-1bf5-4fge-9168-35ed487cd515" }
 *                     email: { type: string, format: email, example: "escort@test.com" }
 *                     role: { type: string, example: "PROVIDER" }
 *                     display_name: { type: string, example: "Amaka XO" }
 *                     call_number: { type: string, example: "+2348012345678" }
 *                     whatsapp_number: { type: string, example: "+2348012345678" }
 *                     created_at: { type: string, format: date-time }
 *                 providerProfile:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid, example: "7b9c1d8a-3c12-4bde-8caa-88d6c1f5b111" }
 *                     display_name: { type: string, example: "Amaka XO" }
 *                     state: { type: string, example: "Lagos" }
 *                     city: { type: string, example: "Ikeja" }
 *                     verification_status: { type: string, example: "PENDING" }
 *                     is_suspended: { type: boolean, example: false }
 *                     subscription_expires_at: { type: string, format: date-time, nullable: true }
 *                     services:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["GFE", "Massage"]
 *                     rates:
 *                       type: object
 *                       example: { "shortTime": 20000, "overnight": 80000, "weekend": 150000 }
 *                     stats:
 *                       type: object
 *                       example: { "bio": "Soft spoken, classy, and fun.", "callNumber": "+2348012345678", "whatsappNumber": "+2348012345678" }
 *                 media:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       url: { type: string, format: uri }
 *                       type: { type: string, example: "IMAGE" }
 *                       is_cover: { type: boolean }
 *                       is_avatar: { type: boolean }
 *                       created_at: { type: string, format: date-time }
 *                 profileImage:
 *                   type: string
 *                   nullable: true
 *                   example: "https://cdn.example.com/providers/avatar.jpg"
 *                 coverImage:
 *                   type: string
 *                   nullable: true
 *                   example: "https://cdn.example.com/providers/cover.jpg"
 *                 galleryImages:
 *                   type: array
 *                   items: { type: string, format: uri }
 *                   example:
 *                     - "https://cdn.example.com/providers/g1.jpg"
 *                     - "https://cdn.example.com/providers/g2.jpg"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Providers only
 *       404:
 *         description: Provider profile not found
 */
router.get("/me", requireAuth, getMyProfile);

/**
 * @openapi
 * /api/v1/providers/me/media:
 *   get:
 *     summary: Get my provider media only
 *     description: >
 *       Returns only the authenticated provider's media (cover/avatar/gallery).
 *       Provider-only route.
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of provider media
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 media:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid, example: "3d7c1a4f-0b93-4e37-8e60-6e7d9c8c1b21" }
 *                       url: { type: string, format: uri, example: "https://cdn.example.com/providers/g1.jpg" }
 *                       type: { type: string, example: "IMAGE" }
 *                       is_cover: { type: boolean, example: false }
 *                       is_avatar: { type: boolean, example: false }
 *                       created_at: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Providers only
 *       404:
 *         description: Provider profile not found
 */
router.get("/me/media", requireAuth, getMyMedia);

/**
 * @openapi
 * /api/v1/providers/me:
 *   patch:
 *     summary: Update my provider profile
 *     description: >
 *       Allows an authenticated provider to update editable fields:
 *       displayName, whatsappNumber, callNumber, state, city, bio, rates,
 *       add gallery images, and remove gallery images by ID.
 *       Provider-only route.
 *     tags: [Providers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 example: "Amaka XO"
 *               whatsappNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               callNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               state:
 *                 type: string
 *                 example: "Lagos"
 *               city:
 *                 type: string
 *                 example: "Ikeja"
 *               bio:
 *                 type: string
 *                 example: "Soft spoken, classy, and fun."
 *               rates:
 *                 type: object
 *                 properties:
 *                   shortTime: { type: integer, example: 25000 }
 *                   overnight: { type: integer, example: 90000 }
 *                   weekend: { type: integer, example: 160000 }
 *               newGalleryImages:
 *                 type: array
 *                 description: New gallery image URLs or data URIs to add
 *                 items:
 *                   type: string
 *                   example: "https://cdn.example.com/providers/new1.jpg"
 *                 example:
 *                   - "https://cdn.example.com/providers/new1.jpg"
 *                   - "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
 *               removeGalleryIds:
 *                 type: array
 *                 description: Gallery media IDs to remove (UUIDs)
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example:
 *                   - "b8c1f1a0-6a2a-4e2c-9a73-2c9f9f0b1a11"
 *                   - "a2e3c4d5-6789-4abc-8def-1234567890ab"
 *           examples:
 *             UpdateBioAndRates:
 *               summary: Update bio + rates only
 *               value:
 *                 bio: "Updated bio for my profile."
 *                 rates:
 *                   shortTime: 30000
 *                   overnight: 100000
 *             AddAndRemoveGallery:
 *               summary: Add new gallery images and remove old ones
 *               value:
 *                 newGalleryImages:
 *                   - "https://cdn.example.com/providers/new1.jpg"
 *                   - "https://cdn.example.com/providers/new2.jpg"
 *                 removeGalleryIds:
 *                   - "b8c1f1a0-6a2a-4e2c-9a73-2c9f9f0b1a11"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only providers can update their profile
 *       404:
 *         description: Provider profile not found
 */
router.patch("/me", requireAuth, updateMyProfile);

export default router;
