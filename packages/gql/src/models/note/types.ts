import builder from "../../builder";

builder.objectType("Note", {
  subGraphs: ["www"],
  fields: (t) => ({
    id: t.exposeID("id", { nullable: false }),
    content: t.exposeString("content", { nullable: false }),
    isAnonymous: t.exposeBoolean("isAnonymous", { nullable: false }),
    updatedAt: t.exposeInt("updatedAt"),
    user: t.expose("user", {
      type: "PublicUser",
    }),
  }),
});

builder.objectType("NoteCursor", {
  subGraphs: ["www"],
  fields: (t) => ({
    id: t.exposeString("id"),
    updatedAt: t.exposeInt("updatedAt"),
  }),
});

builder.objectType("NotesWithCursor", {
  subGraphs: ["www"],
  fields: (t) => ({
    hasMore: t.exposeBoolean("hasMore", { nullable: false }),
    cursor: t.expose("cursor", { type: "NoteCursor" }),
    data: t.expose("data", { type: ["Note"] }),
  }),
});

export const NotesFromCursorInput = builder.inputType("NotesFromCursorInput", {
  subGraphs: ["www"],
  fields: (t) => ({
    id: t.string(),
    updatedAt: t.int(),
  }),
});
