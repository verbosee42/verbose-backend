import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/db";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};
type AuthedRequest = Request & { auth?: AuthUser };

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const createPostSchema = z.object({
  content: z.string().min(1).max(2000),
  mediaUrls: z.array(z.string().min(5)).optional(),
});

const createCommentSchema = z.object({
  comment: z.string().min(1).max(500),
});

// helper: map user -> provider profile id
async function getProviderIdByUserId(userId: string) {
  const r = await pool.query(
    `SELECT id FROM provider_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.id as string | undefined;
}

/**
 * GET /api/v1/feeds?page=1&limit=20
 * Public chronological feed
 */
export async function listFeed(req: Request, res: Response) {
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(Math.max(1, toInt(req.query.limit, 20)), 50);
  const offset = (page - 1) * limit;

  const q = `
    SELECT
      p.id,
      p.provider_id,
      p.content,
      p.media_urls,
      p.created_at,

      pr.display_name as provider_name,

      (SELECT url FROM provider_media m
        WHERE m.provider_id = pr.id AND m.is_avatar = true
        ORDER BY m.created_at DESC LIMIT 1) AS provider_avatar,

      (SELECT COUNT(*)::int FROM feed_likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*)::int FROM feed_comments c WHERE c.post_id = p.id) AS comment_count

    FROM feed_posts p
    JOIN provider_profiles pr ON pr.id = p.provider_id
    ORDER BY p.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const r = await pool.query(q, [limit, offset]);

  return res.json({
    page,
    limit,
    count: r.rows.length,
    items: r.rows.map((row) => ({
      id: row.id,
      content: row.content,
      mediaUrls: row.media_urls,
      createdAt: row.created_at,
      provider: {
        id: row.provider_id,
        name: row.provider_name,
        avatarUrl: row.provider_avatar,
      },
      likeCount: row.like_count,
      commentCount: row.comment_count,
    })),
  });
}

/**
 * POST /api/v1/feed
 * Provider creates a post
 */
export async function createFeedPost(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  if (req.auth.role !== "PROVIDER")
    return res.status(403).json({ message: "Providers only" });

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const providerId = await getProviderIdByUserId(req.auth.id);
  if (!providerId)
    return res.status(403).json({ message: "Provider profile not found" });

  const { content, mediaUrls } = parsed.data;

  const r = await pool.query(
    `
    INSERT INTO feed_posts (provider_id, content, media_urls)
    VALUES ($1, $2, $3)
    RETURNING id, provider_id, content, media_urls, created_at
    `,
    [providerId, content, mediaUrls ?? []],
  );

  return res.status(201).json({
    id: r.rows[0].id,
    providerId: r.rows[0].provider_id,
    content: r.rows[0].content,
    mediaUrls: r.rows[0].media_urls,
    createdAt: r.rows[0].created_at,
  });
}

/**
 * GET /api/v1/feed/:postId
 * Deep link view
 */
export async function getFeedPost(req: Request, res: Response) {
  const postId = req.params.postId;

  const r = await pool.query(
    `
    SELECT
      p.id,
      p.provider_id,
      p.content,
      p.media_urls,
      p.created_at,

      pr.display_name as provider_name,
      (SELECT url FROM provider_media m
        WHERE m.provider_id = pr.id AND m.is_avatar = true
        ORDER BY m.created_at DESC LIMIT 1) AS provider_avatar,

      (SELECT COUNT(*)::int FROM feed_likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*)::int FROM feed_comments c WHERE c.post_id = p.id) AS comment_count
    FROM feed_posts p
    JOIN provider_profiles pr ON pr.id = p.provider_id
    WHERE p.id = $1
    LIMIT 1
    `,
    [postId],
  );

  const row = r.rows[0];
  if (!row) return res.status(404).json({ message: "Post not found" });

  return res.json({
    id: row.id,
    content: row.content,
    mediaUrls: row.media_urls,
    createdAt: row.created_at,
    provider: {
      id: row.provider_id,
      name: row.provider_name,
      avatarUrl: row.provider_avatar,
    },
    likeCount: row.like_count,
    commentCount: row.comment_count,
  });
}

/**
 * POST /api/v1/feed/:postId/like
 */
export async function likePost(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  const postId = req.params.postId;

  // ensure post exists
  const p = await pool.query(
    `SELECT id FROM feed_posts WHERE id = $1 LIMIT 1`,
    [postId],
  );
  if (!p.rows[0]) return res.status(404).json({ message: "Post not found" });

  await pool.query(
    `
    INSERT INTO feed_likes (post_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (post_id, user_id) DO NOTHING
    `,
    [postId, req.auth.id],
  );

  return res.json({ ok: true });
}

/**
 * DELETE /api/v1/feed/:postId/like
 */
export async function unlikePost(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  const postId = req.params.postId;

  await pool.query(
    `DELETE FROM feed_likes WHERE post_id = $1 AND user_id = $2`,
    [postId, req.auth.id],
  );

  return res.json({ ok: true });
}

/**
 * GET /api/v1/feed/:postId/comments
 */
export async function listComments(req: Request, res: Response) {
  const postId = req.params.postId;

  const r = await pool.query(
    `
    SELECT
      c.id,
      c.comment,
      c.created_at,
      u.id as user_id,
      u.display_name as user_name,
      u.role as user_role
    FROM feed_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id = $1
    ORDER BY c.created_at ASC
    `,
    [postId],
  );

  return res.json({
    count: r.rows.length,
    items: r.rows.map((x) => ({
      id: x.id,
      comment: x.comment,
      createdAt: x.created_at,
      user: { id: x.user_id, name: x.user_name, role: x.user_role },
    })),
  });
}

/**
 * POST /api/v1/feed/:postId/comments
 */
export async function addComment(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const postId = req.params.postId;

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid payload", errors: parsed.error.flatten() });

  // ensure post exists
  const p = await pool.query(
    `SELECT id FROM feed_posts WHERE id = $1 LIMIT 1`,
    [postId],
  );
  if (!p.rows[0]) return res.status(404).json({ message: "Post not found" });

  const r = await pool.query(
    `
    INSERT INTO feed_comments (post_id, user_id, comment)
    VALUES ($1, $2, $3)
    RETURNING id, comment, created_at
    `,
    [postId, req.auth.id, parsed.data.comment],
  );

  return res.status(201).json({
    id: r.rows[0].id,
    comment: r.rows[0].comment,
    createdAt: r.rows[0].created_at,
  });
}
