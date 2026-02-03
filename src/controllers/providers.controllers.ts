import { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/db";

type AuthUser = {
  id: string;
  role: "GUEST" | "PROVIDER" | "ADMIN";
  email?: string;
};
type AuthedRequest = Request & { auth?: AuthUser };

// Media string validation (URL or base64)
const mediaString = z
  .string()
  .min(5)
  .refine(
    (v) =>
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("data:"),
    "Media must be a URL or a data URI (base64)",
  );

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  whatsappNumber: z.string().min(7).max(30).optional(),
  callNumber: z.string().min(7).max(30).optional(),
  state: z.string().min(2).max(60).optional(),
  city: z.string().min(2).max(60).optional(),
  bio: z.string().max(1000).optional(),
  rates: z
    .object({
      shortTime: z.number().int().positive().optional(),
      overnight: z.number().int().positive().optional(),
      weekend: z.number().int().positive().optional(),
    })
    .optional(),
  // Services array - for updating provider services
  services: z.array(z.string()).optional(),
  // Gallery: new images to add
  newGalleryImages: z.array(mediaString).optional(),
  // Gallery: URLs of images to remove (changed from IDs to URLs)
  removeGalleryUrls: z.array(z.string()).optional(),
});

/**
 * GET /api/v1/providers/me
 * Get current provider's full profile with media
 */
export async function getMyProfile(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  if (req.auth.role !== "PROVIDER") {
    return res.status(403).json({ message: "Providers only" });
  }

  const userId = req.auth.id;

  try {
    // Get user data
    const userRes = await pool.query(
      `SELECT id, email, role, display_name, call_number, whatsapp_number, created_at
       FROM users
       WHERE id = $1`,
      [userId],
    );

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    // Get provider profile
    const pRes = await pool.query(
      `SELECT id, display_name, state, city, verification_status, is_suspended, 
              subscription_expires_at, services, rates, stats, bio
       FROM provider_profiles
       WHERE user_id = $1`,
      [userId],
    );

    const providerProfile = pRes.rows[0];
    if (!providerProfile) {
      return res.status(404).json({ message: "Provider profile not found" });
    }

    // Get all media
    const mediaRes = await pool.query(
      `SELECT id, url, type, is_cover, is_avatar, created_at
       FROM provider_media
       WHERE provider_id = $1
       ORDER BY created_at DESC`,
      [providerProfile.id],
    );

    const media = mediaRes.rows;

    // Extract specific images for convenience
    const avatar = media.find((m: any) => m.is_avatar);
    const cover = media.find((m: any) => m.is_cover);
    const gallery = media.filter((m: any) => !m.is_avatar && !m.is_cover);

    return res.json({
      user,
      providerProfile,
      media,
      // Convenience fields for frontend
      profileImage: avatar?.url || null,
      coverImage: cover?.url || null,
      galleryImages: gallery.map((m: any) => m.url),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * GET /api/v1/providers/me/media
 * Get current provider's media (images) only
 */
export async function getMyMedia(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  if (req.auth.role !== "PROVIDER") {
    return res.status(403).json({ message: "Providers only" });
  }

  const userId = req.auth.id;

  try {
    // Get provider profile ID
    const pRes = await pool.query(
      `SELECT id FROM provider_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    const provider = pRes.rows[0];
    if (!provider) {
      return res.status(404).json({ message: "Provider profile not found" });
    }

    // Get all media for this provider
    const mediaRes = await pool.query(
      `SELECT id, url, type, is_cover, is_avatar, created_at
       FROM provider_media
       WHERE provider_id = $1
       ORDER BY created_at DESC`,
      [provider.id],
    );

    return res.json({ media: mediaRes.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
}

/**
 * PATCH /api/v1/providers/me
 * Update current provider's profile
 *
 * Editable fields:
 * - displayName
 * - whatsappNumber
 * - callNumber
 * - state
 * - city
 * - bio
 * - rates (shortTime, overnight, weekend)
 * - services (array of service strings)
 * - gallery (add new images, remove existing by URL)
 */
export async function updateMyProfile(req: AuthedRequest, res: Response) {
  if (!req.auth) return res.status(401).json({ message: "Unauthorized" });

  if (req.auth.role !== "PROVIDER") {
    return res
      .status(403)
      .json({ message: "Only providers can update their profile" });
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  const userId = req.auth.id;
  const data = parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Get current provider profile
    const providerRes = await client.query(
      `SELECT id, stats, rates, services FROM provider_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    const provider = providerRes.rows[0];
    if (!provider) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Provider profile not found" });
    }

    const providerId = provider.id;

    // 2) Parse existing stats and rates
    const currentStats =
      typeof provider.stats === "string"
        ? JSON.parse(provider.stats)
        : provider.stats || {};

    const currentRates =
      typeof provider.rates === "string"
        ? JSON.parse(provider.rates)
        : provider.rates || {};

    // 3) Update stats JSONB fields
    if (data.whatsappNumber !== undefined) {
      currentStats.phoneNumber = data.whatsappNumber;
      currentStats.whatsappNumber = data.whatsappNumber;
    }
    if (data.callNumber !== undefined) {
      currentStats.callNumber = data.callNumber;
    }
    if (data.bio !== undefined) {
      currentStats.bio = data.bio;
    }

    // 4) Update rates JSONB
    if (data.rates !== undefined) {
      if (data.rates.shortTime !== undefined)
        currentRates.shortTime = data.rates.shortTime;
      if (data.rates.overnight !== undefined)
        currentRates.overnight = data.rates.overnight;
      if (data.rates.weekend !== undefined)
        currentRates.weekend = data.rates.weekend;
    }

    // 5) Build provider_profiles update query
    const profileUpdates: string[] = [];
    const profileValues: any[] = [];
    let idx = 1;

    if (data.displayName !== undefined) {
      profileUpdates.push(`display_name = $${idx++}`);
      profileValues.push(data.displayName);
    }
    if (data.state !== undefined) {
      profileUpdates.push(`state = $${idx++}`);
      profileValues.push(data.state);
    }
    if (data.city !== undefined) {
      profileUpdates.push(`city = $${idx++}`);
      profileValues.push(data.city);
    }
    if (data.bio !== undefined) {
      profileUpdates.push(`bio = $${idx++}`);
      profileValues.push(data.bio);
    }

    // Handle services update
    if (data.services !== undefined) {
      profileUpdates.push(`services = $${idx++}::text[]`);
      profileValues.push(data.services);
    }
    // Always update stats and rates
    profileUpdates.push(`stats = $${idx++}::jsonb`);
    profileValues.push(JSON.stringify(currentStats));

    profileUpdates.push(`rates = $${idx++}::jsonb`);
    profileValues.push(JSON.stringify(currentRates));

    profileUpdates.push(`updated_at = now()`);

    // 6) Execute provider_profiles update
    profileValues.push(providerId);
    const updateQuery = `
      UPDATE provider_profiles 
      SET ${profileUpdates.join(", ")}
      WHERE id = $${idx}
      RETURNING id, user_id, display_name, state, city, bio, services, rates, stats, verification_status
    `;
    const updateRes = await client.query(updateQuery, profileValues);

    // 7) Update users table (display_name and phone numbers)
    if (data.displayName !== undefined) {
      await client.query(
        `UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`,
        [data.displayName, userId],
      );
    }
    if (data.whatsappNumber !== undefined) {
      await client.query(
        `UPDATE users SET whatsapp_number = $1, updated_at = now() WHERE id = $2`,
        [data.whatsappNumber, userId],
      );
    }
    if (data.callNumber !== undefined) {
      await client.query(
        `UPDATE users SET call_number = $1, updated_at = now() WHERE id = $2`,
        [data.callNumber, userId],
      );
    }

    // 8) Handle gallery: Remove images BY URL (not ID)
    if (data.removeGalleryUrls && data.removeGalleryUrls.length > 0) {
      for (const url of data.removeGalleryUrls) {
        await client.query(
          `DELETE FROM provider_media 
           WHERE provider_id = $1 
           AND url = $2
           AND is_cover = false 
           AND is_avatar = false`,
          [providerId, url],
        );
      }
      console.log(`Deleted ${data.removeGalleryUrls.length} gallery images`);
    }

    // 9) Handle gallery: Add new images
    if (data.newGalleryImages && data.newGalleryImages.length > 0) {
      for (const imageUrl of data.newGalleryImages) {
        await client.query(
          `INSERT INTO provider_media (provider_id, url, type, is_cover, is_avatar)
           VALUES ($1, $2, 'IMAGE', false, false)`,
          [providerId, imageUrl],
        );
      }
      console.log(`Added ${data.newGalleryImages.length} new gallery images`);
    }

    // 10) Fetch updated media (gallery)
    const galleryRes = await client.query(
      `SELECT id, url, type, is_cover, is_avatar, created_at 
       FROM provider_media 
       WHERE provider_id = $1 
       ORDER BY created_at DESC`,
      [providerId],
    );

    await client.query("COMMIT");

    // Log services update for debugging
    if (data.services !== undefined) {
      console.log(
        `Updated services for provider ${providerId}:`,
        data.services.length,
        "services",
      );
    }

    return res.json({
      ok: true,
      provider: updateRes.rows[0],
      media: galleryRes.rows,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}
