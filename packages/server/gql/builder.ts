import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import { DateResolver, JSONResolver } from "graphql-scalars";
import {
  SelectAccount,
  SelectMessage,
  SelectNote,
  SelectUser,
} from "../db/schema";

type Cursor<T> = {
  id?: string;
  hasMore: boolean;
} & T;

type WithUser<T> = T & { user?: SelectUser | null };

type MessageCursor = Cursor<{ createdAt?: number }>;
type NoteCursor = Cursor<{ updatedAt?: number | null }>;

type WithCursor<T> = {
  cursor: T extends SelectMessage ? MessageCursor : NoteCursor;
  data: WithUser<T extends SelectMessage ? SelectMessage : SelectNote>[];
};

const builder = new SchemaBuilder<{
  AuthScopes: {
    authenticated: boolean;
  };
  Objects: {
    User: SelectUser & {
      note?: SelectNote | null;
      profile?: SelectAccount[] | null;
    };
    Profile: SelectAccount;
    Note: WithUser<SelectNote>;
    Message: WithUser<SelectMessage>;
    MessageCursor: MessageCursor;
    NoteCursor: NoteCursor;
    NotesWithCursor: WithCursor<SelectNote>;
    MessagesWithCursor: WithCursor<SelectMessage>;
  };
  Context: {
    currentUser: SelectUser;
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
  plugins: [ScopeAuthPlugin],
  authScopes: async (ctx) => ({
    authenticated: !!ctx.currentUser,
  }),
});

builder.addScalarType("JSON", JSONResolver);
builder.addScalarType("Date", DateResolver);

export default builder;
