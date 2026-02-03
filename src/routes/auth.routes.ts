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
import { loginLimiter, registerLimiter } from "../middlewares/rateLimit";

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
router.post("/register-guest", registerLimiter, registerGuest);

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
 *             required:
 *               - email
 *               - password
 *               - whatsappNumber
 *               - callNumber
 *               - realName
 *               - displayName
 *               - dob
 *               - gender
 *               - ethnicity
 *               - state
 *               - city
 *               - height
 *               - weight
 *               - build
 *               - hairColor
 *               - eyeColor
 *               - services
 *               - rates
 *               - coverImage
 *               - profileImage
 *               - galleryImages
 *               - verificationSelfie
 *             properties:
 *               email:
 *                 type: string
 *                 example: escort@test.com
 *               password:
 *                 type: string
 *                 example: StrongPass123!
 *               whatsappNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               callNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               referralCode:
 *                 type: string
 *                 nullable: true
 *                 description: Optional referral code
 *                 example: REF12345
 *               realName:
 *                 type: string
 *                 example: Amaka Nwoye
 *               displayName:
 *                 type: string
 *                 example: Amaka XO
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: "2000-01-12"
 *               gender:
 *                 type: string
 *                 example: Female
 *               ethnicity:
 *                 type: string
 *                 example: Black
 *               state:
 *                 type: string
 *                 example: Lagos
 *               city:
 *                 type: string
 *                 example: Ikeja
 *               height:
 *                 type: string
 *                 example: "5'7"
 *               weight:
 *                 type: string
 *                 example: "65kg"
 *               bustSize:
 *                 type: string
 *                 example: "34C"
 *               build:
 *                 type: string
 *                 example: Curvy
 *               hairColor:
 *                 type: string
 *                 example: Black
 *               eyeColor:
 *                 type: string
 *                 example: Brown
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["GFE", "Massage"]
 *               rates:
 *                 type: object
 *                 required: [shortTime, overnight, weekend]
 *                 properties:
 *                   shortTime:
 *                     type: integer
 *                     example: 20000
 *                   overnight:
 *                     type: integer
 *                     example: 80000
 *                   weekend:
 *                     type: integer
 *                     example: 150000
 *               coverImage:
 *                 type: string
 *                 example: "https://example.com/cover.jpg"
 *               profileImage:
 *                 type: string
 *                 example: "https://example.com/profile.jpg"
 *               galleryImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - "https://example.com/g1.jpg"
 *                   - "https://example.com/g2.jpg"
 *                   - "https://example.com/g3.jpg"
 *               verificationSelfie:
 *                 type: string
 *                 example: "https://example.com/verify.jpg"
 *     responses:
 *       201:
 *         description: Provider account created (Pending Verification)
 *       400:
 *         description: Invalid payload / under 18 / missing required steps
 *       409:
 *         description: Email already in use
 */
router.post("/register-provider", registerLimiter, registerProvider);

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
