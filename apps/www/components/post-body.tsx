import Link from "next/link";
import type { ReactNode } from "react";

// Detects URLs, @mentions, and #hashtags in one pass. Lookbehinds avoid matching
// inside words / email addresses (e.g. foo@bar.com won't linkify as a mention).
const TOKEN_RE =
  /(https?:\/\/[^\s]+)|(?<![\w@])@([a-zA-Z0-9_-]{1,30})|(?<![\w#])#([a-zA-Z0-9_]{1,50})/g;

// Renders post/comment content with clickable links, @mention profile links, and
// #hashtags. Builds React nodes (JSX children auto-escape) — never
// dangerouslySetInnerHTML — so it is XSS-safe by construction.
export function PostBody({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of content.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(content.slice(last, idx));

    const [full, url, mention, hashtag] = m;
    if (url) {
      // The greedy [^\s]+ swallows trailing sentence punctuation / closing
      // brackets into the URL; strip them back out (and re-emit as plain text)
      // so the href stays valid — e.g. "https://x.com." -> link + ".".
      const trailing = url.match(/[).,!?;:'"\]]+$/)?.[0] ?? "";
      const cleanUrl = trailing ? url.slice(0, -trailing.length) : url;
      nodes.push(
        <a
          key={key++}
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-pink-500 hover:underline break-all"
        >
          {cleanUrl}
        </a>,
      );
      if (trailing) nodes.push(trailing);
    } else if (mention) {
      nodes.push(
        <Link
          key={key++}
          href={`/user/${mention}`}
          className="text-pink-500 hover:underline"
        >
          @{mention}
        </Link>,
      );
    } else if (hashtag) {
      nodes.push(
        <span key={key++} className="text-pink-500">
          #{hashtag}
        </span>,
      );
    } else {
      nodes.push(full);
    }

    last = idx + full.length;
  }

  if (last < content.length) nodes.push(content.slice(last));

  return <p className={className}>{nodes}</p>;
}
