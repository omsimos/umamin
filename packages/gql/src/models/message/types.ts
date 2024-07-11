import builder from "../../builder";

builder.objectType("Message", {
  fields: (t) => ({
    id: t.exposeID("id"),
    question: t.exposeString("question", { nullable: false }),
    content: t.exposeString("content", { nullable: false }),
    reply: t.exposeString("reply"),
    receiverId: t.exposeString("receiverId", { nullable: false }),
    createdAt: t.exposeInt("createdAt", { nullable: false }),
    updatedAt: t.exposeInt("updatedAt"),
    receiver: t.expose("receiver", {
      type: "User",
    }),
  }),
});

builder.objectType("MessageCursor", {
  fields: (t) => ({
    id: t.exposeString("id"),
    createdAt: t.exposeInt("createdAt"),
  }),
});

builder.objectType("MessagesWithCursor", {
  fields: (t) => ({
    hasMore: t.exposeBoolean("hasMore"),
    cursor: t.expose("cursor", { type: "MessageCursor" }),
    data: t.expose("data", { type: ["Message"] }),
  }),
});

export const CreateMessageInput = builder.inputType("CreateMessageInput", {
  fields: (t) => ({
    question: t.string({
      required: true,
      validate: { minLength: 1, maxLength: 500 },
    }),
    content: t.string({
      required: true,
      validate: { minLength: 1, maxLength: 500 },
    }),
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
