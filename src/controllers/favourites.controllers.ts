import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/db";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};
type AuthedRequest = Request & { auth?: AuthUser };

const uuidParamSchema = z.string().uuid();

export async function addFavorite(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const parsed = uuidParamSchema.safeParse(req.params.providerId);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid providerId" });

  const providerId = parsed.data;
  const userId = req.auth.id;

  // Ensure provider exists
  const pRes = await pool.query(
    `SELECT id FROM provider_profiles WHERE id = $1 LIMIT 1`,
    [providerId],
  );
  if (!pRes.rows[0])
    return res.status(404).json({ message: "Provider not found" });

  // Insert favorite (idempotent)
  await pool.query(
    `
    INSERT INTO favorites (user_id, provider_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, provider_id) DO NOTHING
    `,
    [userId, providerId],
  );

  return res.status(201).json({ ok: true });
}

export async function removeFavorite(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const parsed = uuidParamSchema.safeParse(req.params.providerId);
  if (!parsed.success)
    return res.status(400).json({ message: "Invalid providerId" });

  const providerId = parsed.data;
  const userId = req.auth.id;

  await pool.query(
    `DELETE FROM favorites WHERE user_id = $1 AND provider_id = $2`,
    [userId, providerId],
  );

  return res.json({ ok: true });
}

export async function listFavorites(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  const userId = req.auth.id;

  const r = await pool.query(
    `
    SELECT
      p.id AS provider_id,
      p.display_name,
      p.state,
      p.city,
      p.verification_status,
      p.subscription_expires_at,
      p.created_at,

      (SELECT url FROM provider_media m
        WHERE m.provider_id = p.id AND m.is_cover = true
        ORDER BY m.created_at DESC
        LIMIT 1) AS cover_url,

      (SELECT url FROM provider_media m
        WHERE m.provider_id = p.id AND m.is_avatar = true
        ORDER BY m.created_at DESC
        LIMIT 1) AS avatar_url

    FROM favorites f
    JOIN provider_profiles p ON p.id = f.provider_id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
    `,
    [userId],
  );

  return res.json({
    count: r.rows.length,
    items: r.rows.map((x) => ({
      providerId: x.provider_id,
      displayName: x.display_name,
      state: x.state,
      city: x.city,
      verificationStatus: x.verification_status,
      subscriptionExpiresAt: x.subscription_expires_at,
      coverUrl: x.cover_url,
      avatarUrl: x.avatar_url,
      createdAt: x.created_at,
    })),
  });
}
