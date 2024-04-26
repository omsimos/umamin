import builder from "../../builder";

builder.queryFields((t) => ({
  hello: t.field({
    type: "String",
    args: {
      name: t.arg.string(),
    },
    resolve: async (_root, { name }) => {
      return `Hello, ${name || "World"}!`;
    },
  }),
}));

builder.mutationFields((t) => ({
  hello: t.field({
    type: "String",
    args: {
      name: t.arg.string(),
    },
    resolve: async (_root, { name }) => {
      return `Hello, ${name || "World"}!`;
    },
  }),
}));
