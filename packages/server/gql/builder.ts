import SchemaBuilder from "@pothos/core";
import { SelectMessage, SelectUser } from "../db/schema";
import { DateResolver, JSONResolver } from "graphql-scalars";

const builder = new SchemaBuilder<{
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
}>({});

builder.addScalarType("JSON", JSONResolver);
builder.addScalarType("Date", DateResolver);

export default builder;
