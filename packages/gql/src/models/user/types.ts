import builder from "../../builder";

builder.objectType("Account", {
  subGraphs: ["www", "social"],
  fields: (t) => ({
    id: t.exposeID("providerUserId", { nullable: false }),
    email: t.exposeString("email", { nullable: false }),
    picture: t.exposeString("picture", { nullable: false }),
    createdAt: t.exposeInt("createdAt", { nullable: false }),
  }),
});

builder.objectType("User", {
  subGraphs: ["www", "social"],
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    displayName: t.exposeString("displayName"),
    username: t.exposeString("username", { nullable: false }),
    bio: t.exposeString("bio"),
    question: t.exposeString("question", { nullable: false }),
    quietMode: t.exposeBoolean("quietMode", { nullable: false }),
    imageUrl: t.exposeString("imageUrl"),
    createdAt: t.exposeInt("createdAt", { nullable: false }),
    accounts: t.expose("accounts", {
      type: ["Account"],
    }),
  }),
});

builder.objectType("PublicUser", {
  subGraphs: ["www", "social"],
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    displayName: t.exposeString("displayName"),
    username: t.exposeString("username", { nullable: false }),
    bio: t.exposeString("bio"),
    question: t.exposeString("question", { nullable: false }),
    quietMode: t.exposeBoolean("quietMode", { nullable: false }),
    imageUrl: t.exposeString("imageUrl"),
    createdAt: t.exposeInt("createdAt", { nullable: false }),
  }),
});

export const UpdateUserInput = builder.inputType("UpdateUserInput", {
  subGraphs: ["www", "social"],
  fields: (t) => ({
    username: t.string({
      required: true,
      validate: { minLength: 5, maxLength: 20 },
    }),
    bio: t.string({ validate: { maxLength: 150 } }),
    question: t.string({
      required: true,
      validate: { minLength: 1, maxLength: 150 },
    }),
    displayName: t.string({ required: true, validate: { maxLength: 20 } }),
  }),
});
