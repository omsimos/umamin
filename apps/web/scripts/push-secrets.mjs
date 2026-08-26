#!/usr/bin/env node
// Push `.secrets.<env>` to a deployed Worker's secret store.
//
// Why not plain `wrangler secret bulk .secrets.production --env production`:
// that uploads EVERY key in the file, and a key whose value is blank is stored
// as an empty string rather than skipped. A half-filled file therefore wipes
// live secrets, silently — production has already ended up holding a secret that
// was present as a binding and falsy at runtime, which reads as a feature that
// is simply off. This wrapper drops blank values instead, and prints exactly
// what it will set.
//
// Deleting a secret stays a deliberate, separate act:
//   wrangler secret delete <NAME> --env <env>
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

// Targeted by worker NAME, not by `--env`: wrangler.jsonc's staging block is
// named "umamin-web", but the worker actually serving dev.umamin.link (with the
// crons and every binding) is the top-level "umamin-web-dev" — "umamin-web" is
// an abandoned stub from one `--env staging` deploy. Until that is reconciled,
// `--env staging` would push secrets to the wrong worker.
const TARGETS = {
  staging: "umamin-web-dev",
  production: "umamin-web-production",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const env = args.find((arg) => !arg.startsWith("-"));
const target = TARGETS[env];

if (!target) {
  console.error(
    `usage: node scripts/push-secrets.mjs <${Object.keys(TARGETS).join("|")}> [--dry-run]`,
  );
  process.exit(1);
}

const file = `.secrets.${env}`;
let raw;
try {
  raw = readFileSync(file, "utf-8");
} catch {
  console.error(
    `${file} not found. Copy .dev.vars.example to ${file} and fill in the ${env} values.`,
  );
  process.exit(1);
}

const values = {};
const blank = [];
for (const line of raw.split("\n")) {
  const match = /^\s*([A-Z_0-9]+)\s*=\s*(.*)$/.exec(line);
  if (!match) continue;
  const key = match[1];
  // Strip one layer of matching quotes, the way dotenv does.
  const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  if (value) values[key] = value;
  else blank.push(key);
}

const names = Object.keys(values).sort();
if (names.length === 0) {
  console.error(`${file} has no non-empty values — nothing to push.`);
  process.exit(1);
}

console.log(`Setting ${names.length} secret(s) on ${env} (${target}):`);
for (const name of names) console.log(`  ${name}`);
if (blank.length > 0) {
  console.log(
    `Skipped ${blank.length} blank value(s): ${blank.sort().join(", ")}`,
  );
}

if (dryRun) {
  console.log("--dry-run: nothing sent.");
  process.exit(0);
}

// `wrangler secret bulk` reads JSON from stdin when given no file argument.
const wrangler = spawn("wrangler", ["secret", "bulk", "--name", target], {
  stdio: ["pipe", "inherit", "inherit"],
});
wrangler.stdin.end(JSON.stringify(values));
wrangler.on("exit", (code) => process.exit(code ?? 1));
