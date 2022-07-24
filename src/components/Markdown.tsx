import React from 'react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';

export const Markdown = ({ content }: { content: string }) => {
  return (
    <article className='prose prose-invert max-w-none pb-24'>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
};
