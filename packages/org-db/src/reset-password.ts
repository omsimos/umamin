import { eq } from "drizzle-orm";
import {
  generateDefaultPassword,
  hashPassword,
  normalizeUsername,
} from "./auth";
import { db } from "./index";
import { orgTable } from "./schema/org";
import { orgSessionTable } from "./schema/session";

// Re-issues a default password for an existing org (e.g. lockout recovery).
// Sets must_change_password so they're forced to change it again on next login,
// and signs out every existing session so a hijacked one doesn't survive.
//
//   pnpm --filter=@umamin/org-db reset-password <username>

async function main() {
  const [rawUsername] = process.argv.slice(2);
  if (!rawUsername) {
    console.error(
      "Usage: pnpm --filter=@umamin/org-db reset-password <username>",
    );
    process.exit(1);
  }

  const username = normalizeUsername(rawUsername);
  const password = generateDefaultPassword();
  const passwordHash = await hashPassword(password);

  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(orgTable)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(orgTable.username, username))
      .returning({ id: orgTable.id });

    const org = rows[0];
    if (org) {
      await tx.delete(orgSessionTable).where(eq(orgSessionTable.orgId, org.id));
    }
    return rows;
  });

  if (updated.length === 0) {
    console.error(`No org found with username "${username}".`);
    process.exit(1);
  }

  console.log("\n✅ Password reset\n");
  console.log(`  username:   ${username}`);
  console.log(`  password:   ${password}`);
  console.log(
    "\nEvery device is signed out. A session used in the last minute can keep working for up to 60 seconds, because the app caches sessions in Redis for that long.\n",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
