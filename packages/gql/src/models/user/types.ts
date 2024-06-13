import builder from "../../builder";

builder.objectType("Account", {
  fields: (t) => ({
    id: t.exposeID("providerUserId"),
    email: t.exposeString("email"),
    picture: t.exposeString("picture"),
    createdAt: t.exposeInt("createdAt"),
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
    accounts: t.expose("accounts", {
      type: ["Account"],
      nullable: true,
    }),
  }),
});

builder.objectType("PublicUser", {
  fields: (t) => ({
    id: t.exposeID("id"),
    username: t.exposeString("username"),
    bio: t.exposeString("bio", { nullable: true }),
    question: t.exposeString("question"),
    quietMode: t.exposeBoolean("quietMode"),
    imageUrl: t.exposeString("imageUrl", { nullable: true }),
    createdAt: t.exposeInt("createdAt"),
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
