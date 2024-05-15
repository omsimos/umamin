import builder from "../../builder";

builder.objectType("Message", {
  fields: (t) => ({
    id: t.exposeID("id"),
    question: t.exposeString("question"),
    content: t.exposeString("content"),
    userId: t.exposeString("userId"),
    senderId: t.exposeString("senderId", { nullable: true }),
    createdAt: t.exposeString("createdAt"),
    user: t.expose("user", {
      type: "User",
      nullable: true,
    }),
  }),
});

builder.objectType("MessageCursor", {
  fields: (t) => ({
    id: t.exposeString("id", { nullable: true }),
    createdAt: t.exposeString("createdAt", { nullable: true }),
    hasMore: t.exposeBoolean("hasMore"),
  }),
});

builder.objectType("MessagesWithCursor", {
  fields: (t) => ({
    cursor: t.expose("cursor", { type: "MessageCursor" }),
    data: t.expose("data", { type: ["Message"] }),
  }),
});

export const CreateMessageInput = builder.inputType("CreateMessageInput", {
  fields: (t) => ({
    question: t.string({ required: true }),
    content: t.string({ required: true }),
    senderId: t.string(),
    userId: t.string({ required: true }),
  }),
});

export const CursorInput = builder.inputType("CursorInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    createdAt: t.string({ required: true }),
  }),
});

export const MessagesFromCursorInput = builder.inputType(
  "MessagesFromCursorInput",
  {
    fields: (t) => ({
      type: t.string({ required: true }),
      cursor: t.field({ type: CursorInput, required: true }),
    }),
  },
);
