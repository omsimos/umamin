import builder from "../../builder";

builder.objectType("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    username: t.exposeString("username"),
    email: t.exposeString("email"),
    imageUrl: t.exposeString("imageUrl"),
    createdAt: t.exposeString("createdAt"),
  }),
});
