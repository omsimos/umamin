import type { SelectMessage } from "@umamin/db/schema/message";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ReceivedMessageMenu } from "./received-card-menu";

export function ReceivedMessageCard({ data }: { data: SelectMessage }) {
  return (
    <div id={`umamin-${data.id}`}>
      <div
        className={cn(
          "min-w-2 w-full group relative bg-card p-6 rounded-xl border",
        )}
      >
        <div className="absolute top-4 right-4 text-muted-foreground">
          <ReceivedMessageMenu
            {...data}
            reply={data.reply}
            updatedAt={data.updatedAt}
          />
        </div>

        <p className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-4">
          {data.question}
        </p>
        <div className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted break-words min-w-0">
          {data.content}
        </div>
        <p className="text-muted-foreground text-sm mt-4 italic text-center">
          {formatDistanceToNow(data.createdAt, {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );
}
