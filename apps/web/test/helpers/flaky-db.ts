import type { Db } from "../../src/server-lib/db";

/** What Turso answers when its gateway drops a response. */
export function gatewayError() {
  return Object.assign(
    new Error("SERVER_ERROR: Server returned HTTP status 502"),
    { code: "SERVER_ERROR" },
  );
}

type Overrides = Partial<Record<keyof Db, unknown>>;

function wrap(db: Db, overrides: (target: Db) => Overrides): Db {
  const replaced = overrides(db);
  return new Proxy(db, {
    get(target, prop) {
      if (prop in replaced) return replaced[prop as keyof Db];
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** The transaction commits, then the response is lost: the caller sees an
 *  error for a write that landed. With `failReadsAfter`, every select made
 *  after that also fails. */
export function commitThenFail(
  db: Db,
  { failReadsAfter = false }: { failReadsAfter?: boolean } = {},
): Db {
  let committed = false;
  return wrap(db, (target) => ({
    transaction: async (...args: Parameters<Db["transaction"]>) => {
      await target.transaction(...args);
      committed = true;
      throw gatewayError();
    },
    select: (...args: Parameters<Db["select"]>) => {
      if (committed && failReadsAfter) throw gatewayError();
      return target.select(...args);
    },
  }));
}

/** The transaction fails before it commits. */
export function failTransaction(db: Db): Db {
  return wrap(db, () => ({
    transaction: async () => {
      throw gatewayError();
    },
  }));
}
