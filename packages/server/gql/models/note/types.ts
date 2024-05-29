import builder from "../../builder";

builder.objectType("Note", {
  fields: (t) => ({
    id: t.exposeID("id"),
    userId: t.exposeString("userId"),
    content: t.exposeString("content"),
    isAnonymous: t.exposeBoolean("isAnonymous"),
    createdAt: t.exposeInt("createdAt"),
    updatedAt: t.exposeInt("updatedAt", { nullable: true }),
    user: t.expose("user", {
      type: "User",
      nullable: true,
    }),
  }),
});

builder.objectType("NoteCursor", {
  fields: (t) => ({
    id: t.exposeString("id", { nullable: true }),
    updatedAt: t.exposeInt("updatedAt", { nullable: true }),
    hasMore: t.exposeBoolean("hasMore"),
  }),
});

builder.objectType("NotesWithCursor", {
  fields: (t) => ({
    cursor: t.expose("cursor", { type: "NoteCursor" }),
    data: t.expose("data", { type: ["Note"] }),
  }),
});

export const NotesFromCursorInput = builder.inputType("NotesFromCursorInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    updatedAt: t.int({ required: true }),
  }),
});
