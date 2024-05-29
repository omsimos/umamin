import builder from "../../builder";

builder.objectType("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    username: t.exposeString("username"),
    bio: t.exposeString("bio", { nullable: true }),
    question: t.exposeString("question"),
    quietMode: t.exposeBoolean("quietMode"),
    imageUrl: t.exposeString("imageUrl", { nullable: true }),
    createdAt: t.exposeInt("createdAt"),
    updatedAt: t.exposeInt("updatedAt", { nullable: true }),
    note: t.expose("note", {
      type: "Note",
      nullable: true,
    }),
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
