import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/db";

type AuthUser = { id: string; role: "GUEST" | "PROVIDER" | "ADMIN"; email?: string };
type AuthedRequest = Request & { auth?: AuthUser };

const approveSchema = z.object({
  note: z.string().max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(3).max(500),
});

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

//GET /api/v1/admin/providers?status=PENDING|APPROVED|REJECTED
 
export async function listProviders(req: AuthedRequest, res: Response) {
  const status = String(req.query.status ?? "PENDING").toUpperCase();
  const page = toInt(req.query.page, 1);
  const limit = Math.min(toInt(req.query.limit, 20), 100);
  const offset = (page - 1) * limit;

  // only allow these statuses
  const allowed = new Set(["PENDING", "APPROVED", "REJECTED", "NOT_SUBMITTED"]);
  if (!allowed.has(status)) return res.status(400).json({ message: "Invalid status" });

  const result = await pool.query(
    `
    SELECT
      p.id,
      p.user_id,
      p.display_name,
      p.state,
      p.city,
      p.verification_status,
      p.verification_rejection_reason,
      p.is_suspended,
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

    FROM provider_profiles p
    WHERE p.verification_status = $1
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [status, limit, offset]
  );

  return res.json({
    page,
    limit,
    count: result.rows.length,
    providers: result.rows,
  });
}

/**
 * GET /api/v1/admin/providers/:providerId
 * Returns full verification packet:
 * - provider profile including stats JSON (contains hidden realName)
 * - media list
 */
export async function getProvider(req: AuthedRequest, res: Response) {
  const providerId = req.params.providerId;

  const pRes = await pool.query(
    `
    SELECT
      p.*,
      u.email as user_email,
      u.phone as user_phone
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = $1
    LIMIT 1
    `,
    [providerId]
  );

  const provider = pRes.rows[0];
  if (!provider) return res.status(404).json({ message: "Provider not found" });

  const mRes = await pool.query(
    `
    SELECT id, url, type, is_cover, is_avatar, created_at
    FROM provider_media
    WHERE provider_id = $1
    ORDER BY created_at DESC
    `,
    [providerId]
  );

  return res.json({
    provider,
    media: mRes.rows,
  });
}

/**
 * POST /api/v1/admin/providers/:providerId/approve
 */
export async function approveProvider(req: AuthedRequest, res: Response) {
  const providerId = req.params.providerId;

  const parsed = approveSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const adminUserId = req.auth!.id;
  const note = parsed.data.note ?? null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `
      UPDATE provider_profiles
      SET
        verification_status = 'APPROVED',
        verification_rejection_reason = NULL,
        updated_at = now()
      WHERE id = $1
      RETURNING id, user_id, verification_status
      `,
      [providerId]
    );

    const updated = updateRes.rows[0];
    if (!updated) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Provider not found" });
    }

    await client.query(
      `
      INSERT INTO admin_actions (admin_user_id, action, target_provider_id, meta)
      VALUES ($1, $2, $3, $4::jsonb)
      `,
      [adminUserId, "PROVIDER_APPROVED", providerId, JSON.stringify({ note })]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      providerId,
      status: updated.verification_status,
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
 * POST /api/v1/admin/providers/:providerId/reject
 * body: { reason: string }
 */
export async function rejectProvider(req: AuthedRequest, res: Response) {
  const providerId = req.params.providerId;

  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const adminUserId = req.auth!.id;
  const reason = parsed.data.reason;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `
      UPDATE provider_profiles
      SET
        verification_status = 'REJECTED',
        verification_rejection_reason = $2,
        updated_at = now()
      WHERE id = $1
      RETURNING id, user_id, verification_status
      `,
      [providerId, reason]
    );

    const updated = updateRes.rows[0];
    if (!updated) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Provider not found" });
    }

    await client.query(
      `
      INSERT INTO admin_actions (admin_user_id, action, target_provider_id, meta)
      VALUES ($1, $2, $3, $4::jsonb)
      `,
      [adminUserId, "PROVIDER_REJECTED", providerId, JSON.stringify({ reason })]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      providerId,
      status: updated.verification_status,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}
