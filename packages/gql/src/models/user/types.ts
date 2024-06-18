import { ObjectRef } from "@pothos/core";
import builder from "../../builder";
import { SelectAccount, SelectUser } from "@umamin/db/schema/user";

builder.objectType("Account", {
  fields: (t) => ({
    id: t.exposeID("providerUserId"),
    email: t.exposeString("email"),
    picture: t.exposeString("picture"),
    createdAt: t.exposeInt("createdAt"),
  }),
});

function addCommonFields(refs: ObjectRef<SelectUser>[]) {
  for (const ref of refs) {
    builder.objectFields(ref, (t) => ({
      id: t.exposeID("id"),
      displayName: t.exposeString("displayName", { nullable: true }),
      username: t.exposeString("username"),
      bio: t.exposeString("bio", { nullable: true }),
      question: t.exposeString("question"),
      quietMode: t.exposeBoolean("quietMode"),
      imageUrl: t.exposeString("imageUrl", { nullable: true }),
      createdAt: t.exposeInt("createdAt"),
    }));
  }
}

const UserObject = builder
  .objectRef<SelectUser & { accounts: SelectAccount[] }>("User")
  .implement({
    fields: (t) => ({
      accounts: t.expose("accounts", {
        type: ["Account"],
        nullable: true,
      }),
    }),
  });

const PublicUserObject = builder
  .objectRef<SelectUser>("PublicUser")
  .implement({});

addCommonFields([UserObject, PublicUserObject]);

export const UpdateUserInput = builder.inputType("UpdateUserInput", {
  fields: (t) => ({
    username: t.string({ required: true }),
    bio: t.string(),
    question: t.string({ required: true }),
    quietMode: t.boolean({ required: true }),
    displayName: t.string({ required: true }),
  }),
});
