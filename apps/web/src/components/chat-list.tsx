import {
  ChatAvatar,
  ChatBubble,
  ChatRow,
  ChatThread,
} from "@umamin/ui/components/chat";

type Props = {
  imageUrl?: string | null;
  question: string;
  reply?: string;
  response?: string;
};

// Static 1–3 turn preview (profile chat form, note reply, sent card). The live
// conversation surface is routes/-inbox/thread-view.tsx.
export const ChatList = ({ imageUrl, question, reply, response }: Props) => {
  return (
    <ChatThread className="min-w-0">
      <ChatRow side="incoming" avatar={<ChatAvatar src={imageUrl} />}>
        <ChatBubble side="incoming">{question}</ChatBubble>
      </ChatRow>

      {reply && (
        <ChatRow side="outgoing">
          <ChatBubble side="outgoing">{reply}</ChatBubble>
        </ChatRow>
      )}

      {response && (
        <ChatRow side="incoming" avatar={<ChatAvatar src={imageUrl} />}>
          <ChatBubble side="incoming">{response}</ChatBubble>
        </ChatRow>
      )}
    </ChatThread>
  );
};
