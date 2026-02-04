import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../src/config/db";

/**
 * Reset a user's password (any role). Useful when promoting a provider to ADMIN
 * and you need to set a known password for admin login.
 *
 * Usage:
 *   npx ts-node scripts/reset-admin-password.ts <email> [newPassword]
 *
 * If newPassword is omitted, reads from env RESET_ADMIN_PASSWORD.
 *
 * Examples:
 *   npx ts-node scripts/reset-admin-password.ts escort@test.com "Oluwafemi7&"
 *   npx ts-node scripts/reset-admin-password.ts other@example.com
 *   RESET_ADMIN_PASSWORD=MySecret123 npx ts-node scripts/reset-admin-password.ts other@example.com
 */
async function main() {
  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];
  const passwordEnv = process.env.RESET_ADMIN_PASSWORD;

  const email = emailArg?.trim().toLowerCase();
  const newPassword = passwordArg?.trim() || passwordEnv?.trim();

  if (!email) {
    console.error(
      "Usage: npx ts-node scripts/reset-admin-password.ts <email> [newPassword]",
    );
    console.error("  Or set RESET_ADMIN_PASSWORD env var and pass only email.");
    process.exit(1);
  }

  if (!newPassword || newPassword.length < 6) {
    console.error(
      "Provide a new password (min 6 chars) as second argument or RESET_ADMIN_PASSWORD env.",
    );
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const result = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, role",
    [hash, email],
  );

  if (result.rowCount === 0) {
    console.log("No user found with email:", email);
  } else {
    console.log("Password updated for:", result.rows[0]);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
