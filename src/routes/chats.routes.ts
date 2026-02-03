import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  createOrGetChat,
  listChats,
  listMessages,
  sendMessage,
  markChatRead,
} from "../controllers/chats.controllers";

const router = Router();

/**
 * All chat routes require authentication
 */
router.use(requireAuth);

/**
 * @openapi
 * /api/v1/chats:
 *   post:
 *     summary: Create or get a conversation with a provider
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [providerUserId]
 *             properties:
 *               providerUserId:
 *                 type: string
 *                 format: uuid
 *                 example: "c1b3e2f4-1234-4cde-9f11-abc123456789"
 *     responses:
 *       201:
 *         description: Conversation created or returned
 */
router.post("/", createOrGetChat);

/**
 * @openapi
 * /api/v1/chats:
 *   get:
 *     summary: List user's conversations
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get("/", listChats);

/**
 * @openapi
 * /api/v1/chats/{conversationId}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 30
 *     responses:
 *       200:
 *         description: Messages retrieved
 */
router.get("/:conversationId/messages", listMessages);

/**
 * @openapi
 * /api/v1/chats/{conversationId}/messages:
 *   post:
 *     summary: Send a message in a conversation
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Hello, are you available tonight?"
 *     responses:
 *       201:
 *         description: Message sent
 */
router.post("/:conversationId/messages", sendMessage);

/**
 * @openapi
 * /api/v1/chats/{conversationId}/read:
 *   post:
 *     summary: Mark conversation as read
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation marked as read
 */
router.post("/:conversationId/read", markChatRead);

export default router;
