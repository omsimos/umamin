// Public org profile shown on the submit page (never includes passwordHash).
export type PublicOrg = {
  id: string;
  username: string;
  displayName: string | null;
  question: string;
  imageUrl: string | null;
  acceptingMessages: boolean;
  messageCharLimit: number | null;
};

// The signed-in org's own view (adds the first-run flag).
export type CurrentOrg = PublicOrg & {
  mustChangePassword: boolean;
};

// A received message as the dashboard consumes it. `createdAt` is epoch ms.
export type OrgMessageItem = {
  id: string;
  question: string;
  content: string;
  createdAt: number;
};

export type MessagesResponse = {
  messages: OrgMessageItem[];
  nextCursor: string | null;
};
