import SchemaBuilder from "@pothos/core";
import ScopeAuthPlugin from "@pothos/plugin-scope-auth";
import { SelectMessage, SelectUser } from "../db/schema";
import { DateResolver, JSONResolver } from "graphql-scalars";

const builder = new SchemaBuilder<{
  AuthScopes: {
    authenticated: boolean;
  };
  Objects: {
    User: SelectUser;
    Message: SelectMessage & {
      user?: SelectUser;
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
