import type { ComponentProps } from "react";
import { useChatLink } from "@/hooks/use-chat-link";
import { Link } from "@/lib/navigation";

type Props = Omit<
  ComponentProps<"a">,
  "href" | "target" | "rel" | "aria-current"
> & {
  /** utm_content for the external link while the flag is off. */
  utm: string;
};

/** A link to Umamin Chat that follows the rollout flag (see useChatLink).
 *  Spreads its props, so it works as an `asChild` target. */
export function UmaminChatLink({ utm, children, ...props }: Props) {
  const { href, external } = useChatLink(utm);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}
