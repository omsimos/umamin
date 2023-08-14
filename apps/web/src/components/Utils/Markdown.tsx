import React from 'react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';

export const Markdown = ({ content }: { content: string }) => {
  return (
    <article className='prose prose-invert max-w-none pb-24'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className='text-secondary-300 prose-headings:text-secondary-300 dark:prose-headings:text-white prose-strong:text-secondary-300 dark:prose-strong:text-white prose-a:text-secondary-300 dark:prose-a:text-white dark:text-white'
      >
        {content}
      </ReactMarkdown>
    </article>
  );
};
