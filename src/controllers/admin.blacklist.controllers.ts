import { Request, Response } from "express";
import { pool } from "../config/db";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};
type AuthedRequest = Request & { auth?: AuthUser };

// POST /api/v1/admin/blacklist/:entryId/verify
export async function verifyBlacklistEntry(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  if (req.auth.role !== "ADMIN")
    return res.status(403).json({ message: "Admin only" });

  const entryId = req.params.entryId;

  // Ensure entry exists
  const eRes = await pool.query(
    `SELECT id FROM blacklist_entries WHERE id = $1 LIMIT 1`,
    [entryId],
  );
  if (!eRes.rows[0])
    return res.status(404).json({ message: "Blacklist entry not found" });

  try {
    await pool.query(
      `
      INSERT INTO blacklist_verifications (blacklist_entry_id, admin_user_id)
      VALUES ($1, $2)
      ON CONFLICT (blacklist_entry_id, admin_user_id) DO NOTHING
      `,
      [entryId, req.auth.id],
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS verified_count FROM blacklist_verifications WHERE blacklist_entry_id = $1`,
      [entryId],
    );

    return res.json({
      ok: true,
      entryId,
      verifiedCount: countRes.rows[0].verified_count,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
}
