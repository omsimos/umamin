import builder from "../../builder";

builder.objectType("Note", {
  fields: (t) => ({
    id: t.exposeID("id"),
    content: t.exposeString("content", { nullable: false }),
    isAnonymous: t.exposeBoolean("isAnonymous", { nullable: false }),
    updatedAt: t.exposeInt("updatedAt"),
    user: t.expose("user", {
      type: "PublicUser",
    }),
  }),
});

builder.objectType("NoteCursor", {
  fields: (t) => ({
    id: t.exposeString("id"),
    updatedAt: t.exposeInt("updatedAt"),
  }),
});

builder.objectType("NotesWithCursor", {
  fields: (t) => ({
    hasMore: t.exposeBoolean("hasMore"),
    cursor: t.expose("cursor", { type: "NoteCursor" }),
    data: t.expose("data", { type: ["Note"] }),
  }),
});

export const NotesFromCursorInput = builder.inputType("NotesFromCursorInput", {
  fields: (t) => ({
    id: t.string(),
    updatedAt: t.int(),
  }),
});
