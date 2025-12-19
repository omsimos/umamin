import path from "node:path";
import process from "node:process";
import { faker } from "@faker-js/faker";
import { createClient } from "@libsql/client";
import { aesEncrypt } from "@umamin/encryption";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { reset } from "drizzle-seed";

import * as schema from "./schema";
import { type InsertMessage, messageTable } from "./schema/message";
import { type InsertNote, noteTable } from "./schema/note";
import {
  type InsertPost,
  type InsertPostComment,
  postCommentTable,
  postTable,
} from "./schema/post";
import {
  type InsertSession,
  type InsertUser,
  sessionTable,
  userTable,
} from "./schema/user";

type ClientOptions = Parameters<typeof createClient>[0];
type UserSeed = Omit<InsertUser, "id">;
type SessionSeed = Omit<InsertSession, "userId"> & { username: string };
type NoteSeed = Omit<InsertNote, "userId" | "id"> & { username: string };
type MessageSeed = Omit<
  InsertMessage,
  "receiverId" | "senderId" | "question" | "id"
> & {
  receiverUsername: string;
  senderUsername?: string;
  question?: string;
};
type PostSeed = Omit<
  InsertPost,
  "authorId" | "id" | "commentCount" | "likeCount"
> & { username: string };

const DEFAULT_PROMPT = "Send me an anonymous message!";

const ADDITIONAL_USER_COUNT = 24;

const baseUserSeeds: UserSeed[] = [
  {
    username: "alex",
    displayName: "Alex Kim",
    bio: "Building Umamin and exploring better ways to invite honest feedback.",
    imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Kim",
    question: "What made you smile today?",
  },
  {
    username: "bailey",
    displayName: "Bailey Chen",
    bio: "Product-minded engineer who loves fast shipping and cozy cafes.",
    imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Bailey%20Chen",
    question: "Share a spicy take you've been holding back.",
  },
  {
    username: "casey",
    displayName: "Casey Rivera",
    bio: "Food blogger, part-time barista, always down to trade recipes.",
    imageUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Casey%20Rivera",
    question: "Ask me anything about comfort cooking.",
    quietMode: false,
  },
  {
    username: "testuser",
    displayName: "Test User",
    passwordHash:
      "$argon2id$v=19$m=19456,t=2,p=1$Dy5X2lari62rpz/wftwqLw$91MtimkXBNL4or2bukIhY2uJtl+WFCGHiamGlMiAfBY",
    question: DEFAULT_PROMPT,
  },
];

const userSeeds: UserSeed[] = [...baseUserSeeds];
const usedUsernames = new Set(userSeeds.map((user) => user.username));

const slugifyUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/-{2,}/g, "-")
    .slice(0, 20)
    .replace(/^[-_]+|[-_]+$/g, "");

const ensureUniqueUsername = (candidate: string) => {
  let username = slugifyUsername(candidate);
  if (username.length < 5) {
    username = `${username}${faker.string.alpha({ length: 5 - username.length })}`;
  }
  while (usedUsernames.has(username)) {
    username = slugifyUsername(
      `${candidate}${faker.string.alphanumeric({ length: 3 })}`,
    );
    if (username.length < 5) {
      username = `${username}${faker.string.alpha({ length: 5 - username.length })}`;
    }
  }
  usedUsernames.add(username);
  return username;
};

for (let i = 0; i < ADDITIONAL_USER_COUNT; i += 1) {
  const fullName = faker.person.fullName();
  const username = ensureUniqueUsername(faker.internet.username());
  userSeeds.push({
    username,
    displayName: fullName,
    bio: faker.person.bio(),
    imageUrl: `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(fullName)}`,
    question:
      faker.helpers.maybe(() => faker.lorem.sentence({ min: 5, max: 12 }), {
        probability: 0.7,
      }) ?? DEFAULT_PROMPT,
    quietMode: faker.datatype.boolean({ probability: 0.2 }),
  });
}

const sessionSeeds: SessionSeed[] = [
  {
    id: "session_alex_local",
    username: "alex",
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  },
  {
    id: "session_test_local",
    username: "testuser",
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  },
];

const noteOverrides = new Map<string, string>([
  [
    "alex",
    "Launching a new feedback flow next week. Let me know what you think!",
  ],
  ["bailey", "Beta testing the inbox filtering feature. DMs welcome."],
  [
    "testuser",
    "This is your seeded QA account. Try toggling quiet mode or replying to inbox threads.",
  ],
]);

const noteSeeds: NoteSeed[] = userSeeds.map((user) => ({
  username: user.username,
  content:
    noteOverrides.get(user.username) ??
    faker.lorem.paragraphs({ min: 1, max: 2 }),
  isAnonymous:
    user.username === "alex"
      ? false
      : user.username === "bailey"
        ? true
        : faker.datatype.boolean({ probability: 0.35 }),
}));

const userQuestions = new Map(
  userSeeds.map(
    (user) => [user.username, user.question ?? DEFAULT_PROMPT] as const,
  ),
);

const messageSeeds: MessageSeed[] = [
  {
    receiverUsername: "testuser",
    senderUsername: "alex",
    question: userQuestions.get("testuser") ?? DEFAULT_PROMPT,
    content:
      "Great to have a dedicated tester! Can you stress test the inbox filters today?",
    reply: "On it—will share any issues I find.",
  },
  {
    receiverUsername: "alex",
    senderUsername: "testuser",
    question: userQuestions.get("alex") ?? DEFAULT_PROMPT,
    content: "One small win from this week?",
    reply: "Seeing the new onboarding flow click with early users.",
  },
  {
    receiverUsername: "testuser",
    senderUsername: "casey",
    question: userQuestions.get("testuser") ?? DEFAULT_PROMPT,
    content:
      "Does the new composer feel fast enough on mobile? I'm seeing minor lag.",
  },
  {
    receiverUsername: "bailey",
    senderUsername: "testuser",
    question: userQuestions.get("bailey") ?? DEFAULT_PROMPT,
    content:
      "Tried the new filtering UI—love the color coding. Any plans for custom views?",
  },
  {
    receiverUsername: "casey",
    senderUsername: "testuser",
    question: userQuestions.get("casey") ?? DEFAULT_PROMPT,
    content:
      "Comfort food suggestion for launch night? Thinking something one-pot.",
    reply: "Go with a miso butter ramen—simple and musical.",
  },
  {
    receiverUsername: "alex",
    senderUsername: "bailey",
    question: userQuestions.get("alex") ?? DEFAULT_PROMPT,
    content: "What's the hardest part about building Umamin right now?",
    reply: "Balancing new ideas with polishing the core anonymous inbox.",
  },
  {
    receiverUsername: "bailey",
    senderUsername: "casey",
    question: userQuestions.get("bailey") ?? DEFAULT_PROMPT,
    content:
      "Your beta signup flow felt super smooth. Any tips for onboarding?",
  },
  {
    receiverUsername: "casey",
    question: userQuestions.get("casey") ?? DEFAULT_PROMPT,
    content: "What's your go-to comfort recipe after a long launch week?",
    reply: "Kimchi fried rice with a soft egg on top, every single time.",
  },
];

const postOverrides = new Map<string, string[]>([
  [
    "alex",
    [
      "Building in public: we just shipped threaded replies. Feedback welcome!",
      "Question: what’s your favorite onboarding moment in a new app?",
    ],
  ],
  [
    "bailey",
    [
      "Trying a new daily shipping ritual. What helps you stay consistent?",
      "Thinking about a small UI polish pass—anything feel rough right now?",
    ],
  ],
  [
    "casey",
    [
      "Testing a cozy food journaling flow. What should it include?",
      "Hot take: breakfast for dinner always wins.",
    ],
  ],
  [
    "testuser",
    [
      "Seeded QA post: try liking, commenting, and infinite scroll.",
      "If you find a bug, reply here with steps to reproduce.",
    ],
  ],
]);

const postSeeds: PostSeed[] = [];
const additionalPostCount = Math.max(48, userSeeds.length * 2);

for (const user of userSeeds) {
  const overrides = postOverrides.get(user.username) ?? [];
  for (const content of overrides) {
    postSeeds.push({
      username: user.username,
      content,
      createdAt: faker.date.recent({ days: 21 }),
      updatedAt: faker.date.recent({ days: 7 }),
    });
  }
}

for (let i = 0; i < additionalPostCount; i += 1) {
  const author = faker.helpers.arrayElement(userSeeds);
  postSeeds.push({
    username: author.username,
    content: faker.lorem.paragraph({ min: 1, max: 2 }),
    createdAt: faker.date.recent({ days: 30 }),
    updatedAt: faker.date.recent({ days: 10 }),
  });
}

const otherUsernames = userSeeds
  .map((user) => user.username)
  .filter((username) => username !== "testuser");

const randomContent = () => faker.lorem.sentences({ min: 1, max: 3 });
const randomReply = () =>
  faker.datatype.boolean({ probability: 0.35 })
    ? faker.lorem.sentences({ min: 1, max: 2 })
    : undefined;

const MIN_TESTUSER_RECEIVED = 25;
const MIN_TESTUSER_SENT = 25;

const addTestuserReceivedMessage = () => {
  const senderUsername = faker.helpers.arrayElement(otherUsernames);
  messageSeeds.push({
    receiverUsername: "testuser",
    senderUsername: faker.datatype.boolean({ probability: 0.2 })
      ? undefined
      : senderUsername,
    question: userQuestions.get("testuser") ?? DEFAULT_PROMPT,
    content: randomContent(),
    reply: faker.datatype.boolean({ probability: 0.25 })
      ? faker.lorem.sentences({ min: 1, max: 2 })
      : undefined,
  });
};

const addTestuserSentMessage = () => {
  const receiverUsername = faker.helpers.arrayElement(otherUsernames);
  messageSeeds.push({
    receiverUsername,
    senderUsername: "testuser",
    question: userQuestions.get(receiverUsername) ?? DEFAULT_PROMPT,
    content: randomContent(),
    reply: randomReply(),
  });
};

while (
  messageSeeds.filter((message) => message.receiverUsername === "testuser")
    .length < MIN_TESTUSER_RECEIVED
) {
  addTestuserReceivedMessage();
}

while (
  messageSeeds.filter((message) => message.senderUsername === "testuser")
    .length < MIN_TESTUSER_SENT
) {
  addTestuserSentMessage();
}

const additionalMessageCount = Math.max(60, userSeeds.length * 3);

for (let i = 0; i < additionalMessageCount; i += 1) {
  const receiver = faker.helpers.arrayElement(userSeeds);
  let sender = faker.helpers.arrayElement(userSeeds);

  if (userSeeds.length > 1) {
    while (sender.username === receiver.username) {
      sender = faker.helpers.arrayElement(userSeeds);
    }
  }

  messageSeeds.push({
    receiverUsername: receiver.username,
    senderUsername: faker.datatype.boolean({ probability: 0.7 })
      ? sender.username
      : undefined,
    question: userQuestions.get(receiver.username) ?? DEFAULT_PROMPT,
    content: randomContent(),
    reply: randomReply(),
  });
}

function resolveClientOptions(): ClientOptions {
  const urlFromEnv =
    process.env.TURSO_CONNECTION_URL ??
    process.env.DATABASE_URL ??
    process.env.LIBSQL_URL ??
    "";

  const url =
    urlFromEnv.trim().length > 0
      ? urlFromEnv
      : `file:${path.resolve(process.cwd(), "local.db")}`;

  if (url.startsWith("file:")) {
    return { url };
  }

  const authToken =
    process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN ?? "";

  if (authToken.trim().length === 0) {
    throw new Error(
      "Missing TURSO_AUTH_TOKEN. Provide credentials or use a local file database.",
    );
  }

  return {
    url,
    authToken,
  };
}

async function main() {
  const clientOptions = resolveClientOptions();
  const client = createClient(clientOptions);
  const db = drizzle(client, { schema });

  try {
    console.info(`Resetting database at ${clientOptions.url}`);
    const sqliteDb = db as unknown as Parameters<typeof reset>[0];
    await reset(sqliteDb, schema);

    await db.transaction(async (tx) => {
      const insertedUsers = await tx
        .insert(userTable)
        .values(
          userSeeds.map((user) => ({
            ...user,
            question: user.question ?? DEFAULT_PROMPT,
          })),
        )
        .returning({ id: userTable.id, username: userTable.username });

      const userIdsByUsername = new Map(
        insertedUsers.map(({ username, id }) => [username, id] as const),
      );

      const userIdOrThrow = (username: string) => {
        const id = userIdsByUsername.get(username);
        if (!id) {
          throw new Error(`Missing user id for username "${username}"`);
        }
        return id;
      };

      if (sessionSeeds.length > 0) {
        await tx.insert(sessionTable).values(
          sessionSeeds.map(({ username, ...session }) => ({
            ...session,
            userId: userIdOrThrow(username),
          })),
        );
      }

      if (noteSeeds.length > 0) {
        await tx.insert(noteTable).values(
          noteSeeds.map(({ username, ...note }) => ({
            ...note,
            userId: userIdOrThrow(username),
          })),
        );
      }

      const insertedPosts =
        postSeeds.length > 0
          ? await tx
              .insert(postTable)
              .values(
                postSeeds.map(({ username, ...post }) => ({
                  ...post,
                  authorId: userIdOrThrow(username),
                })),
              )
              .returning({
                id: postTable.id,
                authorId: postTable.authorId,
                createdAt: postTable.createdAt,
              })
          : [];

      if (insertedPosts.length > 0) {
        const commentValues: InsertPostComment[] = [];
        const commentCounts = new Map<string, number>();

        for (const post of insertedPosts) {
          const desiredCount = faker.number.int({ min: 0, max: 6 });
          if (desiredCount === 0) continue;
          commentCounts.set(post.id, desiredCount);

          for (let i = 0; i < desiredCount; i += 1) {
            const commenter = faker.helpers.arrayElement(userSeeds);
            const createdAt = faker.date.between({
              from: post.createdAt,
              to: new Date(),
            });

            commentValues.push({
              postId: post.id,
              authorId: userIdOrThrow(commenter.username),
              content: faker.lorem.sentences({ min: 1, max: 3 }),
              createdAt,
              updatedAt: createdAt,
              likeCount: faker.number.int({ min: 0, max: 6 }),
            });
          }
        }

        if (commentValues.length > 0) {
          await tx.insert(postCommentTable).values(commentValues);
        }

        if (commentCounts.size > 0) {
          await Promise.all(
            Array.from(commentCounts.entries()).map(([postId, count]) =>
              tx
                .update(postTable)
                .set({ commentCount: count })
                .where(eq(postTable.id, postId)),
            ),
          );
        }
      }

      if (messageSeeds.length > 0) {
        const messageValues = await Promise.all(
          messageSeeds.map(
            async ({
              receiverUsername,
              senderUsername,
              question,
              content,
              reply,
              ...message
            }) => {
              const receiverId = userIdOrThrow(receiverUsername);
              const senderId = senderUsername
                ? userIdOrThrow(senderUsername)
                : undefined;
              const resolvedQuestion =
                question ??
                userQuestions.get(receiverUsername) ??
                DEFAULT_PROMPT;

              const encryptedContent = await aesEncrypt(content);
              const encryptedReply = reply
                ? await aesEncrypt(reply)
                : undefined;

              return {
                ...message,
                question: resolvedQuestion,
                content: encryptedContent,
                reply: encryptedReply,
                receiverId,
                senderId,
              };
            },
          ),
        );

        await tx.insert(messageTable).values(messageValues);
      }
    });

    console.info("Seed data applied successfully.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("Failed to seed database:");
  console.error(error);
  process.exitCode = 1;
});
