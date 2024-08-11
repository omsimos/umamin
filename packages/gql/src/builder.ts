import SchemaBuilder from "@pothos/core";
import ValidationPlugin from "@pothos/plugin-zod";
import SubGraphPlugin from "@pothos/plugin-sub-graph";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import DirectivePlugin from "@pothos/plugin-directives";
import { DateResolver, JSONResolver } from "graphql-scalars";

import { SelectNote } from "@umamin/db/schema/note";
import { SelectMessage } from "@umamin/db/schema/message";
import { SelectAccount, SelectUser } from "@umamin/db/schema/user";

type WithUser<T, K extends string> = T & { [P in K]?: SelectUser | null };

type Cursor<K extends string> = { id?: string | null } & {
  [P in K]?: number | null;
};

type WithCursor<T, K extends string, P extends "createdAt" | "updatedAt"> = {
  hasMore: boolean;
  cursor: Cursor<P> | null;
  data: WithUser<T, K>[] | null;
};

const builder = new SchemaBuilder<{
  AuthScopes: {
    authenticated: boolean;
  };
  SubGraphs: "www" | "social";
  Objects: {
    User: SelectUser & {
      accounts?: SelectAccount[] | null;
    };
    PublicUser: SelectUser;
    Account: SelectAccount;
    Note: WithUser<SelectNote, "user">;
    Message: WithUser<SelectMessage, "receiver">;
    MessageCursor: Cursor<"createdAt">;
    NoteCursor: Cursor<"updatedAt">;
    NotesWithCursor: WithCursor<SelectNote, "user", "updatedAt">;
    MessagesWithCursor: WithCursor<SelectMessage, "receiver", "createdAt">;
  };
  Context: {
    userId?: string;
  };
  Directives: {
    rateLimit: {
      locations: "OBJECT" | "FIELD_DEFINITION";
      args: { limit: number; duration: number };
    };
  };
  Scalars: {
    JSON: {
      Input: unknown;
      Output: unknown;
    };
    Date: {
      Input: Date;
      Output: Date;
    };
  };
}>({
  plugins: [ScopeAuthPlugin, DirectivePlugin, ValidationPlugin, SubGraphPlugin],
  subGraphs: {
    defaultForTypes: [],
    fieldsInheritFromTypes: true,
  },
  scopeAuth: {
    authScopes: async (ctx) => ({
      authenticated: !!ctx.userId,
    }),
  },
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
});

builder.addScalarType("JSON", JSONResolver);
builder.addScalarType("Date", DateResolver);

export default builder;
