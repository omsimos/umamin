import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import { SelectMessage, SelectUser } from "../db/schema";
import { DateResolver, JSONResolver } from "graphql-scalars";

type MessageCursor = {
  id?: string;
  createdAt?: string;
  hasMore: boolean;
};

type UserCursor = {
  id?: string;
  updatedAt?: string | null;
  hasMore: boolean;
};

const builder = new SchemaBuilder<{
  AuthScopes: {
    authenticated: boolean;
  };
  Objects: {
    User: SelectUser;
    Message: SelectMessage & {
      user?: SelectUser;
    };
    MessageCursor: MessageCursor;
    UserCursor: UserCursor;
    UsersWithCursor: {
      cursor: UserCursor;
      data: SelectUser[];
    };
    MessagesWithCursor: {
      cursor: MessageCursor;
      data: SelectMessage[];
    };
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
