import builder from "@server/gql/builder";

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
  }),
});

builder.objectType("NotesWithCursor", {
  fields: (t) => ({
    hasMore: t.exposeBoolean("hasMore"),
    cursor: t.expose("cursor", { type: "NoteCursor", nullable: true }),
    data: t.expose("data", { type: ["Note"], nullable: true }),
  }),
});

export const NotesFromCursorInput = builder.inputType("NotesFromCursorInput", {
  fields: (t) => ({
    id: t.string(),
    updatedAt: t.int(),
  }),
});
