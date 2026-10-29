import { sql } from "drizzle-orm";

// Runs the statement only if the PREVIOUS statement of the same db.batch
// changed a row: changes() reads the preceding statement's count on the shared
// connection, which is how a batch replaces an interactive transaction's
// JS-side branching. test/batch-changes.test.ts pins those semantics.
export const PREV_CHANGED = sql`(SELECT changes()) > 0`;
