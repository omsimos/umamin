import builder from "../../builder";

builder.objectType("Profile", {
  fields: (t) => ({
    id: t.exposeID("providerUserId"),
    email: t.exposeString("email"),
    picture: t.exposeString("picture"),
    createdAt: t.exposeInt("createdAt")
  }),
});

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
    profile: t.expose("profile", {
      type: ["Profile"],
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
