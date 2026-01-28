import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/db";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};
type AuthedRequest = Request & { auth?: AuthUser };

const createBlacklistSchema = z.object({
  phone: z.string().min(6).max(30).optional(),
  name: z.string().min(2).max(120).optional(),
  notes: z.string().min(3).max(2000).optional(),
  evidenceUrls: z.array(z.string().min(5)).optional(),
});

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// GET /api/v1/blacklist?search=&risk=&page=&limit=
export async function listBlacklist(req: Request, res: Response) {
  const search = (req.query.search as string | undefined)?.trim();
  const risk = (req.query.risk as string | undefined)?.trim();
  const page = toInt(req.query.page, 1);
  const limit = Math.min(toInt(req.query.limit, 20), 100);
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (risk) {
    where.push(`b.risk_level = $${i++}`);
    params.push(risk);
  }

  // search by name or id
  if (search) {
    where.push(`(
      b.name ILIKE $${i} OR
      b.phone ILIKE $${i} OR
      CAST(b.id AS text) ILIKE $${i}
    )`);
    params.push(`%${search}%`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const q = `
    SELECT
      b.id,
      b.phone,
      b.name,
      b.notes,
      b.evidence_urls,
      b.risk_level,
      b.created_at,
      COALESCE(v.verified_count, 0) AS verified_count
    FROM blacklist_entries b
    LEFT JOIN (
      SELECT blacklist_entry_id, COUNT(*)::int AS verified_count
      FROM blacklist_verifications
      GROUP BY blacklist_entry_id
    ) v ON v.blacklist_entry_id = b.id
    ${whereSql}
    ORDER BY b.created_at DESC
    LIMIT $${i} OFFSET $${i + 1};
  `;

  params.push(limit, offset);

  const result = await pool.query(q, params);

  return res.json({
    page,
    limit,
    count: result.rows.length,
    items: result.rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      name: r.name,
      reason: r.notes, // UI label "Reason"
      evidenceUrls: r.evidence_urls,
      riskLevel: r.risk_level,
      verifiedCount: r.verified_count,
      createdAt: r.created_at,
    })),
  });
}

// GET /api/v1/blacklist/:id
export async function getBlacklist(req: Request, res: Response) {
  const entryId = req.params.id;

  const result = await pool.query(
    `
    SELECT
      b.*,
      COALESCE(v.verified_count, 0) AS verified_count
    FROM blacklist_entries b
    LEFT JOIN (
      SELECT blacklist_entry_id, COUNT(*)::int AS verified_count
      FROM blacklist_verifications
      WHERE blacklist_entry_id = $1
      GROUP BY blacklist_entry_id
    ) v ON v.blacklist_entry_id = b.id
    WHERE b.id = $1
    LIMIT 1
    `,
    [entryId],
  );

  const row = result.rows[0];
  if (!row)
    return res.status(404).json({ message: "Blacklist entry not found" });

  return res.json({
    id: row.id,
    phone: row.phone,
    name: row.name,
    reason: row.notes,
    evidenceUrls: row.evidence_urls,
    riskLevel: row.risk_level,
    verifiedCount: row.verified_count,
    createdAt: row.created_at,
  });
}

// POST /api/v1/blacklist (provider submits)
export async function createBlacklist(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  if (req.auth.role !== "PROVIDER")
    return res.status(403).json({ message: "Providers only" });

  const parsed = createBlacklistSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const { phone, name, notes, evidenceUrls } = parsed.data;

  if (!phone && !name) {
    return res
      .status(400)
      .json({ message: "Provide at least phone number or name" });
  }

  const pRes = await pool.query(
    `SELECT id FROM provider_profiles WHERE user_id = $1 LIMIT 1`,
    [req.auth.id],
  );
  const provider = pRes.rows[0];
  if (!provider)
    return res.status(403).json({ message: "Provider profile not found" });

  const result = await pool.query(
    `
    INSERT INTO blacklist_entries (submitted_by_provider_id, phone, name, notes, evidence_urls)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, phone, name, notes, evidence_urls, risk_level, created_at
    `,
    [
      provider.id,
      phone ?? null,
      name ?? null,
      notes ?? null,
      evidenceUrls ?? [],
    ],
  );

  return res.status(201).json({
    id: result.rows[0].id,
    phone: result.rows[0].phone,
    name: result.rows[0].name,
    reason: result.rows[0].notes,
    evidenceUrls: result.rows[0].evidence_urls,
    riskLevel: result.rows[0].risk_level,
    createdAt: result.rows[0].created_at,
  });
}
