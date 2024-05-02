import builder from "../../builder";

builder.objectType("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    username: t.exposeString("username"),
    bio: t.exposeString("bio", { nullable: true }),
    question: t.exposeString("question"),
    googleId: t.exposeString("googleId"),
    note: t.exposeString("note", { nullable: true }),
    email: t.exposeString("email"),
    imageUrl: t.exposeString("imageUrl"),
    createdAt: t.exposeString("createdAt"),
  }),
});

export const UpdateUserInput = builder.inputType("UpdateUserInput", {
  fields: (t) => ({
    username: t.string({ required: true }),
    bio: t.string(),
    question: t.string({ required: true }),
    quietMode: t.boolean({ required: true }),
  }),
});
