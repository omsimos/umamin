import { SelectMessage } from "@umamin/db/schema/message";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReceivedMessageMenu } from "./received-card-menu";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

export function ReceivedMessageCard({ data }: { data: SelectMessage }) {
  // const deletedMessages = useMessageStore((state) => state.deletedList);

  // const isDeleted = useMemo(
  //   () => deletedMessages.includes(data.id),
  //   [deletedMessages, data.id],
  // );

  const isDeleted = false; // Placeholder until state management is implemented

  return (
    <div id={`umamin-${data.id}`} className="container">
      <Card
        className={cn("min-w-2 w-full group relative", {
          "opacity-50": isDeleted,
        })}
      >
        {!isDeleted && (
          <div className="absolute top-4 right-4 text-muted-foreground">
            <ReceivedMessageMenu
              {...data}
              reply={data.reply}
              updatedAt={data.updatedAt}
            />
          </div>
        )}
        <CardHeader className="flex px-12">
          <p className="font-bold text-center leading-normal text-lg min-w-0 break-words">
            {data.question}
          </p>
        </CardHeader>
        <CardContent>
          <div
            data-testid="received-data-content"
            className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted break-words min-w-0"
          >
            {data.content}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <span className="text-muted-foreground text-sm mt-1 italic w-full text-center">
            {formatDistanceToNow(data.createdAt, {
              addSuffix: true,
            })}
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
