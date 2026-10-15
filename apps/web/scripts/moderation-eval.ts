// Local-only threshold tuning for the content classifier. Not part of CI: it
// calls the real model and costs (very little) money.
//
//   pnpm eval:moderation seed out.csv [--base https://www.umamin.link] [--pages 10]
//     Pulls public posts and notes into a CSV with an empty `expected` column.
//
//   pnpm eval:moderation run labeled.csv [--out results.json]
//     `expected` per row is one of: severe, drama, clean. Prints precision and
//     recall at each threshold so SEVERE_THRESHOLD / DRAMA_THRESHOLD in
//     server-lib/content-label.ts can be set from real data.
//
//   pnpm eval:moderation check [scripts/moderation-cases.json]
//     Regression suite: hand-written cases with the label each must get.
//     Run it after any change to the questions, the context wording, or the
//     thresholds. Exits 1 on any mismatch.
//
// Reads AI_GATEWAY_API_KEY from the environment or apps/web/.dev.vars.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ContentKind,
  type ContentScores,
  classifyContent,
} from "../src/server-lib/content-classifier";
import {
  DRAMA_THRESHOLD,
  SEVERE_THRESHOLD,
} from "../src/server-lib/content-label";
import type { AppEnv } from "../src/server-lib/env";

type Row = {
  text: string;
  kind: ContentKind;
  context: string;
  expected: string;
};

const [mode, file, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
};

function apiKey() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    const line = readFileSync(join(import.meta.dirname, "../.dev.vars"), "utf8")
      .split("\n")
      .find((l) => l.startsWith("AI_GATEWAY_API_KEY="));
    return line
      ?.slice("AI_GATEWAY_API_KEY=".length)
      .trim()
      .replace(/^"|"$/g, "");
  } catch {
    return undefined;
  }
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

async function seed(out: string) {
  const base = flag("base") ?? "https://www.umamin.link";
  const pages = Number(flag("pages") ?? 10);
  const rows: Row[] = [];
  for (const [path, kind] of [
    ["/api/public/posts?sort=latest", "post"],
    ["/api/public/notes", "note"],
  ] as const) {
    let cursor: string | null = null;
    for (let page = 0; page < pages; page++) {
      const url = `${base}${path}${cursor ? `${path.includes("?") ? "&" : "?"}cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const body = (await res.json()) as {
        data: Array<{ content?: string; post?: { content: string } }>;
        nextCursor: string | null;
      };
      for (const item of body.data) {
        const text = (item.post?.content ?? item.content ?? "").trim();
        if (text) rows.push({ text, kind, context: "", expected: "" });
      }
      cursor = body.nextCursor;
      if (!cursor) break;
    }
  }
  const unique = [...new Map(rows.map((row) => [row.text, row])).values()];
  writeFileSync(
    out,
    `text,kind,context,expected\n${unique
      .map((row) =>
        [row.text, row.kind, row.context, row.expected].map(csvCell).join(","),
      )
      .join("\n")}\n`,
  );
  console.log(`wrote ${unique.length} rows to ${out}; fill in "expected"`);
}

async function run(input: string) {
  const key = apiKey();
  if (!key) throw new Error("AI_GATEWAY_API_KEY is not set");
  const env = { AI_GATEWAY_API_KEY: key } as AppEnv;

  const [header, ...body] = parseCsv(readFileSync(input, "utf8"));
  const col = (name: string) => header.indexOf(name);
  const rows: Row[] = body
    .map((cells) => ({
      text: cells[col("text")] ?? "",
      kind: (cells[col("kind")] || "post") as ContentKind,
      context: cells[col("context")] ?? "",
      expected: (cells[col("expected")] ?? "").trim().toLowerCase(),
    }))
    .filter((row) => ["severe", "drama", "clean"].includes(row.expected));

  const results: Array<Row & { scores: ContentScores | null }> = [];
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        const scores = await classifyContent(env, {
          kind: row.kind,
          text: row.text,
          context: row.context || null,
        });
        results.push({ ...row, scores });
      }
    }),
  );

  const scored = results.filter((r) => r.scores);
  console.log(`${scored.length}/${rows.length} rows classified`);

  const report = (
    label: string,
    isPositive: (r: (typeof scored)[number]) => boolean,
    predict: (r: (typeof scored)[number], t: number) => boolean,
  ) => {
    console.log(`\n${label}\n threshold  precision  recall  flagged`);
    for (let t = 50; t <= 95; t += 5) {
      const flagged = scored.filter((r) => predict(r, t));
      const hits = flagged.filter(isPositive).length;
      const positives = scored.filter(isPositive).length;
      const precision = flagged.length ? hits / flagged.length : 1;
      const recall = positives ? hits / positives : 1;
      console.log(
        ` ${String(t).padStart(9)}  ${precision.toFixed(2).padStart(9)}  ${recall.toFixed(2).padStart(6)}  ${String(flagged.length).padStart(7)}`,
      );
    }
  };

  report(
    "severe",
    (r) => r.expected === "severe",
    (r, t) => (r.scores?.severe ?? 0) >= t,
  );
  report(
    `drama (rows below severe ${SEVERE_THRESHOLD})`,
    (r) => r.expected === "drama",
    (r, t) =>
      (r.scores?.severe ?? 0) < SEVERE_THRESHOLD && (r.scores?.drama ?? 0) >= t,
  );

  const out = flag("out");
  if (out) {
    writeFileSync(out, JSON.stringify(results, null, 2));
    console.log(`\nper-row results in ${out}`);
  }
}

type Expect = "severe" | "scam" | "drama" | "clean" | "covered" | "not-severe";
type Case = {
  id: string;
  kind: ContentKind;
  text: string;
  context?: string;
  thread?: string[];
  question?: string;
  expect: Expect;
};

const label = (scores: ContentScores) =>
  scores.severe >= SEVERE_THRESHOLD
    ? scores.reason === "scam"
      ? "scam"
      : "severe"
    : scores.drama >= DRAMA_THRESHOLD
      ? "drama"
      : "clean";

const ACCEPTS: Record<Expect, string[]> = {
  severe: ["severe"],
  scam: ["scam"],
  drama: ["drama"],
  clean: ["clean"],
  covered: ["severe", "scam", "drama"],
  "not-severe": ["drama", "clean"],
};

async function check(input: string) {
  const key = apiKey();
  if (!key) throw new Error("AI_GATEWAY_API_KEY is not set");
  const env = { AI_GATEWAY_API_KEY: key } as AppEnv;
  const cases = JSON.parse(readFileSync(input, "utf8")) as Case[];

  const failures: string[] = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const classify = () =>
          classifyContent(env, {
            kind: item.kind,
            text: item.text,
            context: item.context ?? null,
            thread: item.thread ?? null,
            question: item.question ?? null,
          });
        // A cold Gateway call can outlast the production timeout.
        const scores = (await classify()) ?? (await classify());
        const got = scores ? label(scores) : "error";
        const ok = ACCEPTS[item.expect].includes(got);
        const line = `${ok ? "pass" : "FAIL"}  ${item.id.padEnd(28)} expect ${item.expect.padEnd(10)} got ${got.padEnd(6)} severe ${scores?.severe ?? "-"} drama ${scores?.drama ?? "-"} ${scores?.reason ?? ""}`;
        console.log(line);
        if (!ok) failures.push(line);
      }
    }),
  );

  console.log(`\n${cases.length - failures.length}/${cases.length} passed`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exit(1);
  }
}

if (mode === "seed" && file) await seed(file);
else if (mode === "run" && file) await run(file);
else if (mode === "check")
  await check(file ?? join(import.meta.dirname, "moderation-cases.json"));
else {
  console.error(
    "usage: pnpm eval:moderation seed <out.csv> [--base url] [--pages n]\n       pnpm eval:moderation run <labeled.csv> [--out results.json]\n       pnpm eval:moderation check [cases.json]",
  );
  process.exit(1);
}
