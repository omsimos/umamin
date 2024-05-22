import builder from "../../builder";

builder.objectType("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    username: t.exposeString("username"),
    bio: t.exposeString("bio", { nullable: true }),
    question: t.exposeString("question"),
    quietMode: t.exposeBoolean("quietMode"),
    note: t.exposeString("note", { nullable: true }),
    imageUrl: t.exposeString("imageUrl", { nullable: true }),
    createdAt: t.exposeString("createdAt"),
    updatedAt: t.exposeString("updatedAt", { nullable: true }),
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

builder.objectType("UserCursor", {
  fields: (t) => ({
    id: t.exposeString("id", { nullable: true }),
    updatedAt: t.exposeString("updatedAt", { nullable: true }),
    hasMore: t.exposeBoolean("hasMore"),
  }),
});

builder.objectType("UsersWithCursor", {
  fields: (t) => ({
    cursor: t.expose("cursor", { type: "UserCursor" }),
    data: t.expose("data", { type: ["User"] }),
  }),
});

export const UsersWithNoteFromCursorInput = builder.inputType(
  "UsersWithNoteFromCursorInput",
  {
    fields: (t) => ({
      id: t.string({ required: true }),
      updatedAt: t.string({ required: true }),
    }),
  },
);
