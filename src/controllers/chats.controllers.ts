import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/db";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};
type AuthedRequest = Request & { auth?: AuthUser };

const createChatSchema = z.object({
  providerUserId: z.string().uuid(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

/**
 * Fix for Express typings: sometimes route params can be typed as string | string[].
 * This safely narrows to a string.
 */
function getParam(param: string | string[] | undefined): string {
  if (!param) throw new Error("Missing route parameter");
  return Array.isArray(param) ? param[0] : param;
}

async function ensureConversationMember(
  conversationId: string,
  userId: string,
) {
  const r = await pool.query(
    `SELECT id, client_user_id, provider_user_id
     FROM conversations
     WHERE id = $1
     LIMIT 1`,
    [conversationId],
  );

  const convo = r.rows[0];
  if (!convo)
    return {
      ok: false as const,
      status: 404,
      message: "Conversation not found",
    };

  const isMember =
    convo.client_user_id === userId || convo.provider_user_id === userId;
  if (!isMember)
    return { ok: false as const, status: 403, message: "Forbidden" };

  return { ok: true as const, convo };
}

/**
 * POST /api/v1/chats
 * Body: { providerUserId }
 * Creates or returns existing conversation between current user (client) and provider user.
 */
export async function createOrGetChat(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const parsed = createChatSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const clientUserId = req.auth.id;
  const providerUserId = parsed.data.providerUserId;

  // PRD: User clicks Message (client side). Provider can reply later.
  if (req.auth.role !== "GUEST") {
    return res
      .status(403)
      .json({ message: "Only clients can start a new chat" });
  }

  // Ensure provider user exists and has PROVIDER role
  const prov = await pool.query(
    `SELECT id, role FROM users WHERE id = $1 LIMIT 1`,
    [providerUserId],
  );
  if (!prov.rows[0])
    return res.status(404).json({ message: "Provider user not found" });
  if (prov.rows[0].role !== "PROVIDER")
    return res.status(400).json({ message: "Target user is not a provider" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const convoRes = await client.query(
      `
      INSERT INTO conversations (client_user_id, provider_user_id)
      VALUES ($1, $2)
      ON CONFLICT (client_user_id, provider_user_id)
      DO UPDATE SET last_message_at = conversations.last_message_at
      RETURNING id, client_user_id, provider_user_id, created_at, last_message_at
      `,
      [clientUserId, providerUserId],
    );

    const convo = convoRes.rows[0];

    // Ensure read rows exist for both users
    await client.query(
      `
      INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
      VALUES ($1, $2, now())
      ON CONFLICT (conversation_id, user_id) DO NOTHING
      `,
      [convo.id, clientUserId],
    );

    await client.query(
      `
      INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
      VALUES ($1, $2, now())
      ON CONFLICT (conversation_id, user_id) DO NOTHING
      `,
      [convo.id, providerUserId],
    );

    await client.query("COMMIT");

    return res.status(201).json({ conversation: convo });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

/**
 * GET /api/v1/chats?page=1&limit=20
 * Returns user's conversations with last message + unread count.
 */
export async function listChats(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const userId = req.auth.id;
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(Math.max(1, toInt(req.query.limit, 20)), 50);
  const offset = (page - 1) * limit;

  const q = `
    SELECT
      c.id,
      c.client_user_id,
      c.provider_user_id,
      c.created_at,
      c.last_message_at,

      CASE
        WHEN c.client_user_id = $1 THEN c.provider_user_id
        ELSE c.client_user_id
      END AS other_user_id,

      u.display_name AS other_user_name,
      u.role AS other_user_role,

      pp.display_name AS provider_display_name,
      (SELECT url FROM provider_media m
        WHERE m.provider_id = pp.id AND m.is_avatar = true
        ORDER BY m.created_at DESC LIMIT 1) AS provider_avatar,

      lm.content AS last_message,
      lm.created_at AS last_message_created_at,

      COALESCE((
        SELECT COUNT(*)::int
        FROM messages msg
        JOIN conversation_reads cr
          ON cr.conversation_id = c.id AND cr.user_id = $1
        WHERE msg.conversation_id = c.id
          AND msg.created_at > cr.last_read_at
          AND msg.sender_user_id <> $1
      ), 0) AS unread_count

    FROM conversations c
    JOIN users u
      ON u.id = CASE WHEN c.client_user_id = $1 THEN c.provider_user_id ELSE c.client_user_id END
    LEFT JOIN provider_profiles pp
      ON pp.user_id = u.id

    LEFT JOIN LATERAL (
      SELECT content, created_at
      FROM messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON true

    WHERE c.client_user_id = $1 OR c.provider_user_id = $1
    ORDER BY c.last_message_at DESC
    LIMIT $2 OFFSET $3
  `;

  const r = await pool.query(q, [userId, limit, offset]);

  return res.json({
    page,
    limit,
    count: r.rows.length,
    items: r.rows.map((x) => ({
      id: x.id,
      createdAt: x.created_at,
      lastMessageAt: x.last_message_at,
      otherUser: {
        id: x.other_user_id,
        name: x.provider_display_name ?? x.other_user_name,
        role: x.other_user_role,
        avatarUrl: x.provider_avatar ?? null,
      },
      lastMessage: x.last_message ?? null,
      lastMessageCreatedAt: x.last_message_created_at ?? null,
      unreadCount: x.unread_count,
    })),
  });
}

/**
 * GET /api/v1/chats/:conversationId/messages?page=1&limit=30
 */
export async function listMessages(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const conversationId = getParam(req.params.conversationId);
  const userId = req.auth.id;

  const membership = await ensureConversationMember(conversationId, userId);
  if (!membership.ok)
    return res.status(membership.status).json({ message: membership.message });

  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(Math.max(1, toInt(req.query.limit, 30)), 100);
  const offset = (page - 1) * limit;

  const r = await pool.query(
    `
    SELECT
      m.id,
      m.sender_user_id,
      u.display_name as sender_name,
      u.role as sender_role,
      m.content,
      m.created_at
    FROM messages m
    JOIN users u ON u.id = m.sender_user_id
    WHERE m.conversation_id = $1
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [conversationId, limit, offset],
  );

  const items = r.rows.reverse().map((x) => ({
    id: x.id,
    sender: { id: x.sender_user_id, name: x.sender_name, role: x.sender_role },
    content: x.content,
    createdAt: x.created_at,
  }));

  return res.json({ page, limit, count: items.length, items });
}

/**
 * POST /api/v1/chats/:conversationId/messages
 * Body: { content }
 */
export async function sendMessage(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const conversationId = getParam(req.params.conversationId);
  const userId = req.auth.id;

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const membership = await ensureConversationMember(conversationId, userId);
  if (!membership.ok)
    return res.status(membership.status).json({ message: membership.message });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const msgRes = await client.query(
      `
      INSERT INTO messages (conversation_id, sender_user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, content, created_at
      `,
      [conversationId, userId, parsed.data.content],
    );

    await client.query(
      `UPDATE conversations SET last_message_at = now() WHERE id = $1`,
      [conversationId],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      id: msgRes.rows[0].id,
      content: msgRes.rows[0].content,
      createdAt: msgRes.rows[0].created_at,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

/**
 * POST /api/v1/chats/:conversationId/read
 * Marks conversation as read for current user (sets last_read_at=now)
 */
export async function markChatRead(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const conversationId = getParam(req.params.conversationId);
  const userId = req.auth.id;

  const membership = await ensureConversationMember(conversationId, userId);
  if (!membership.ok)
    return res.status(membership.status).json({ message: membership.message });

  await pool.query(
    `
    INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
    VALUES ($1, $2, now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `,
    [conversationId, userId],
  );

  return res.json({ ok: true });
}
