import SchemaBuilder from "@pothos/core";
import { DateResolver, JSONResolver } from "graphql-scalars";
import { SelectUser } from "schema";

const builder = new SchemaBuilder<{
  Objects: {
    User: SelectUser;
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
