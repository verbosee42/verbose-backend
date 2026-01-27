import { Router } from "express";
import {
  registerGuest,
  registerProvider,
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controllers";
import { requireAuth } from "../middlewares/auth";

const router = Router();

/**
 * @openapi
 * /api/v1/auth/register-guest:
 *   post:
 *     summary: Register a guest (client) account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName]
 *             properties:
 *               email:
 *                 type: string
 *                 example: guest@test.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               displayName:
 *                 type: string
 *                 example: Guest One
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/register-guest", registerGuest);

/**
 * @openapi
 * /api/v1/auth/register-provider:
 *   post:
 *     summary: Register a provider (escort) account (full onboarding)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName]
 *             properties:
 *               email:
 *                 type: string
 *                 example: escort@test.com
 *               password:
 *                 type: string
 *                 example: StrongPass123!
 *               displayName:
 *                 type: string
 *                 example: Amaka XO
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/register-provider", registerProvider);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: guest@test.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OK
 */
router.post("/login", login);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/me", requireAuth, me);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", requireAuth, logout);

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@test.com
 *     responses:
 *       200:
 *         description: Reset token sent if email exists
 */
router.post("/forgot-password", forgotPassword);

/**
 * @openapi
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 example: reset-token-here
 *               newPassword:
 *                 type: string
 *                 example: NewStrongPass123!
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post("/reset-password", resetPassword);

/**
 * @openapi
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change password (authenticated user)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: OldPass123
 *               newPassword:
 *                 type: string
 *                 example: NewStrongPass123!
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post("/change-password", requireAuth, changePassword);

export default router;
