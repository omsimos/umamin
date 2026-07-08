export const queryKeys = {
  // Prefix key for invalidating every cached page at once.
  allMessages: () => ["messages"] as const,
  messages: (cursor: string | null) => ["messages", cursor] as const,
};
