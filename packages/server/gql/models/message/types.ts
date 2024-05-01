import builder from "../../builder";

builder.objectType("Message", {
  fields: (t) => ({
    id: t.exposeID("id"),
    question: t.exposeString("question"),
    content: t.exposeString("content"),
    userId: t.exposeString("userId"),
    senderId: t.exposeString("senderId", { nullable: true }),
    createdAt: t.exposeString("createdAt"),
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
