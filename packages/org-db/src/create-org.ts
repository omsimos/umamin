import {
  generateDefaultPassword,
  hashPassword,
  normalizeUsername,
  USERNAME_REGEX,
} from "./auth";
import { db } from "./index";
import { orgTable } from "./schema/org";

// Mints a new org account with a generated default password and prints the
// credentials. The org changes the password in Settings on first login
// (must_change_password defaults to true).
//
//   pnpm --filter=@umamin/org-db create-org <username> ["Display Name"]

async function main() {
  const [rawUsername, displayNameArg] = process.argv.slice(2);

  if (!rawUsername) {
    console.error(
      'Usage: pnpm --filter=@umamin/org-db create-org <username> ["Display Name"]',
    );
    process.exit(1);
  }

  const username = normalizeUsername(rawUsername);
  if (!USERNAME_REGEX.test(username)) {
    console.error(
      `Invalid username "${rawUsername}". Use 3-20 lowercase letters, numbers, or underscores.`,
    );
    process.exit(1);
  }

  const displayName = displayNameArg?.trim() || null;
  const password = generateDefaultPassword();
  const passwordHash = await hashPassword(password);

  try {
    const [row] = await db
      .insert(orgTable)
      .values({ username, displayName, passwordHash, mustChangePassword: true })
      .returning({ id: orgTable.id, username: orgTable.username });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://org.umamin.link";

    console.log("\n✅ Org account created\n");
    console.log(`  id:         ${row?.id}`);
    console.log(`  username:   ${username}`);
    console.log(`  password:   ${password}`);
    console.log(`  submit URL: ${baseUrl}/to/${username}`);
    console.log(
      "\nShare the username + password privately. They'll be asked to change it on first login.\n",
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE|unique/.test(err.message)) {
      console.error(`Username "${username}" is already taken.`);
      process.exit(1);
    }
    throw err;
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
