import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import { signAccessToken } from "../utils/jwt";
import { pool } from "../config/db";

/**
 * Local request typing to avoid global Express augmentation issues.
 * Your requireAuth middleware should set req.auth = { id, role }.
 */
type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};

type AuthedRequest = Request & {
  auth?: AuthUser;
};

/** -----------------------
 * Zod Schemas
 * ---------------------- */

// 
const registerGuestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(80),
});

// allow https://... OR data:image/...;base64,...
const mediaString = z
  .string()
  .min(5)
  .refine(
    (v) => v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:"),
    "Media must be a URL or a data URI (base64)"
  );


const registerProviderSchema = z.object({
  // Account Basics
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phoneNumber: z.string().min(7).max(30),

  // Personal Details
  realName: z.string().min(2).max(120), 
  displayName: z.string().min(2).max(80),
  dob: z.string().min(8),
  gender: z.string().min(2).max(40),
  ethnicity: z.string().min(2).max(60),
  state: z.string().min(2).max(60),
  city: z.string().min(2).max(60),

  // Physical Stats
  height: z.string().min(1).max(30),
  weight: z.string().min(1).max(30),
  bustSize: z.string().min(1).max(30).optional(),
  build: z.string().min(1).max(40),
  hairColor: z.string().min(1).max(40),
  eyeColor: z.string().min(1).max(40),

  // Services & Rates
  services: z.array(z.string().min(1).max(60)).min(1, "Select at least 1 service"),
  rates: z.object({
    shortTime: z.number().int().positive(),
    overnight: z.number().int().positive(),
    weekend: z.number().int().positive(),
  }),

  // Gallery Upload
  coverImage: mediaString, // mandatory
  profileImage: mediaString, // mandatory
  galleryImages: z.array(mediaString).min(3, "Gallery must have at least 3 images"),

  // Identity Verification
  verificationSelfie: mediaString, // mandatory
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

/** -----------------------
 * Helpers
 * ---------------------- */

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function calcAge(dobString: string) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** -----------------------
 * Controllers
 * ---------------------- */

export async function registerGuest(req: Request, res: Response) {
  const parsed = registerGuestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const { email, password, displayName } = parsed.data;
  const emailNorm = normalizeEmail(email);

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, display_name)
       VALUES ($1, $2, 'GUEST', $3)
       RETURNING id, email, role, display_name`,
      [emailNorm, passwordHash, displayName]
    );

    const user = result.rows[0];
    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    return res.status(201).json({ user, accessToken });
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ message: "Email already in use" });
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * Creates:
 * - users row (role PROVIDER)
 * - provider_profiles row (PENDING) with services/rates/stats
 * - provider_media rows for cover/avatar/gallery + verification selfie
 */
export async function registerProvider(req: Request, res: Response) {
  const parsed = registerProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const data = parsed.data;

  // Validate 18+
  const age = calcAge(data.dob);
  if (age === null) return res.status(400).json({ message: "Invalid DOB format (expected YYYY-MM-DD)" });
  if (age < 18) return res.status(400).json({ message: "You must be 18+ to register as a provider" });

  const emailNorm = normalizeEmail(data.email);
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Store hidden + personal + physical fields in stats JSONB
  const stats = {
    realName: data.realName, // hidden
    dob: data.dob,
    age,
    gender: data.gender,
    ethnicity: data.ethnicity,
    height: data.height,
    weight: data.weight,
    bustSize: data.bustSize ?? null,
    build: data.build,
    hairColor: data.hairColor,
    eyeColor: data.eyeColor,
    phoneNumber: data.phoneNumber,
    verificationSelfie: data.verificationSelfie, // keep reference here too
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, display_name, phone)
       VALUES ($1, $2, 'PROVIDER', $3, $4)
       RETURNING id, email, role, display_name`,
      [emailNorm, passwordHash, data.displayName, data.phoneNumber]
    );

    const user = userResult.rows[0];

    // 2) Create provider profile (PENDING)
    const providerResult = await client.query(
      `INSERT INTO provider_profiles
        (user_id, display_name, state, city, services, rates, stats, verification_status)
       VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, 'PENDING')
       RETURNING id, verification_status, is_suspended, subscription_expires_at`,
      [
        user.id,
        data.displayName,
        data.state,
        data.city,
        data.services,
        JSON.stringify(data.rates),
        JSON.stringify(stats),
      ]
    );

    const providerProfile = providerResult.rows[0];

    // 3) Media inserts
    // Cover (mandatory)
    await client.query(
      `INSERT INTO provider_media (provider_id, url, type, is_cover, is_avatar)
       VALUES ($1, $2, 'IMAGE', true, false)`,
      [providerProfile.id, data.coverImage]
    );

    // Profile (avatar)
    await client.query(
      `INSERT INTO provider_media (provider_id, url, type, is_cover, is_avatar)
       VALUES ($1, $2, 'IMAGE', false, true)`,
      [providerProfile.id, data.profileImage]
    );

    // Gallery (min 3)
    for (const url of data.galleryImages) {
      await client.query(
        `INSERT INTO provider_media (provider_id, url, type, is_cover, is_avatar)
         VALUES ($1, $2, 'IMAGE', false, false)`,
        [providerProfile.id, url]
      );
    }

    // Verification selfie (store as media row too)
    await client.query(
      `INSERT INTO provider_media (provider_id, url, type, is_cover, is_avatar)
       VALUES ($1, $2, 'IMAGE', false, false)`,
      [providerProfile.id, data.verificationSelfie]
    );

    await client.query("COMMIT");

    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    return res.status(201).json({ user, providerProfile, accessToken });
  } catch (e: any) {
    await client.query("ROLLBACK");
    if (e?.code === "23505") return res.status(409).json({ message: "Email already in use" });
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const emailNorm = normalizeEmail(email);

  const result = await pool.query(
    `SELECT id, email, role, display_name, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [emailNorm]
  );

  const row = result.rows[0];
  if (!row) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = signAccessToken({ sub: row.id, role: row.role });

  return res.json({
    user: { id: row.id, email: row.email, role: row.role, display_name: row.display_name },
    accessToken,
  });
}

export async function me(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  const userId = req.auth.id;

  const userRes = await pool.query(
    `SELECT id, email, role, display_name, phone, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ message: "User not found" });

  let providerProfile = null;
  if (user.role === "PROVIDER") {
    const pRes = await pool.query(
      `SELECT id, display_name, state, city, verification_status, is_suspended, subscription_expires_at, services, rates, stats
       FROM provider_profiles
       WHERE user_id = $1`,
      [userId]
    );
    providerProfile = pRes.rows[0] ?? null;
  }

  return res.json({ user, providerProfile });
}

export async function logout(_req: Request, res: Response) {
  // Stateless JWT: client should delete token.
  return res.json({ ok: true, message: "Logged out" });
}

/**
 * Forgot password flow:
 * - Always return 200 (don’t leak whether email exists)
 * - Create a reset token, store HASH in DB (never store raw token)
 * - MVP: return token in response (remove later and send email)
 */
export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const emailNorm = normalizeEmail(parsed.data.email);

  const userRes = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [emailNorm]);
  const user = userRes.rows[0];

  if (!user) return res.json({ ok: true });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  return res.json({ ok: true, token: rawToken }); // MVP testing
}

export async function resetPassword(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  const { token, newPassword } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tokRes = await client.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );

    const row = tokRes.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    if (row.used_at) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Token already used" });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
      passwordHash,
      row.user_id,
    ]);

    await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [row.id]);

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

export async function changePassword(req: AuthedRequest, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });

  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });
  const userId = req.auth.id;

  const { currentPassword, newPassword } = parsed.data;

  const uRes = await pool.query(`SELECT password_hash FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const row = uRes.rows[0];
  if (!row) return res.status(404).json({ message: "User not found" });

  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

  const newHash = await bcrypt.hash(newPassword, 10);

  await pool.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [newHash, userId]);

  return res.json({ ok: true });
}
