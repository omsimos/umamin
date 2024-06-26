import builder from "../../builder";

builder.objectType("Message", {
  fields: (t) => ({
    id: t.exposeID("id"),
    question: t.exposeString("question"),
    content: t.exposeString("content"),
    reply: t.exposeString("reply", { nullable: true }),
    receiverId: t.exposeString("receiverId"),
    createdAt: t.exposeInt("createdAt"),
    updatedAt: t.exposeInt("updatedAt", { nullable: true }),
    receiver: t.expose("receiver", {
      type: "User",
      nullable: true,
    }),
  }),
});

builder.objectType("MessageCursor", {
  fields: (t) => ({
    id: t.exposeString("id", { nullable: true }),
    createdAt: t.exposeInt("createdAt", { nullable: true }),
  }),
});

builder.objectType("MessagesWithCursor", {
  fields: (t) => ({
    hasMore: t.exposeBoolean("hasMore"),
    cursor: t.expose("cursor", { type: "MessageCursor", nullable: true }),
    data: t.expose("data", { type: ["Message"], nullable: true }),
  }),
});

export const CreateMessageInput = builder.inputType("CreateMessageInput", {
  fields: (t) => ({
    question: t.string({ required: true }),
    content: t.string({ required: true }),
    senderId: t.string(),
    receiverId: t.string({ required: true }),
  }),
});

const CursorInput = builder.inputType("CursorInput", {
  fields: (t) => ({
    id: t.string(),
    createdAt: t.int(),
  }),
});

export const MessagesFromCursorInput = builder.inputType(
  "MessagesFromCursorInput",
  {
    fields: (t) => ({
      type: t.string({ required: true }),
      cursor: t.field({ type: CursorInput }),
    }),
  },
);
