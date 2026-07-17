#!/usr/bin/env bun
/**
 * Promotes a user to ADMIN by email.
 *
 * Usage:
 *   bun run apps/back/scripts/promote-admin.ts user@example.com
 *
 * Reads DATABASE_URL from the project .env file.
 */
import "dotenv/config";
import { Client } from "pg";

const email = process.argv[2];

if (!email) {
  console.error("Usage: bun run apps/back/scripts/promote-admin.ts <email>");
  process.exit(1);
}

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!dbUrl) {
  console.error(
    "Error: DATABASE_URL or DIRECT_URL not found in environment / .env",
  );
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl.replace("?sslmode=require", "?sslmode=disable"),
});

async function main() {
  try {
    await client.connect();

    const user = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email],
    );

    if (user.rows.length === 0) {
      console.error(`User with email "${email}" not found.`);
      console.log("Existing users:");
      const all = await client.query(
        'SELECT email, role FROM users ORDER BY created_at DESC',
      );
      for (const u of all.rows) {
        console.log(`  ${u.email || "(no email)"} — ${u.role}`);
      }
      process.exit(1);
    }

    console.log(`Found: ${user.rows[0].email} (current role: ${user.rows[0].role})`);

    if (user.rows[0].role === "ADMIN") {
      console.log("Already ADMIN — nothing to do.");
      await client.end();
      return;
    }

    await client.query('UPDATE users SET role = $1 WHERE email = $2', [
      "ADMIN",
      email,
    ]);

    console.log(`Role updated to ADMIN for ${email}.`);
    console.log("Log out and back in via WorkOS for the JWT to pick up the new role.");
    await client.end();
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
