import React, { Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

interface Props {
  pageNo: number;
  cursorId: string;
  isLoading: boolean;
  messages?: any;
  setPageNo: Dispatch<SetStateAction<number>>;
  setCursorId: Dispatch<SetStateAction<string>>;
  children: React.ReactNode;
}

export const InboxTabContainer = ({
  cursorId,
  pageNo,
  messages,
  isLoading,
  setCursorId,
  setPageNo,
  children,
}: Props) => {
  return (
    <section className='flex flex-col space-y-6'>
      {!messages?.length && !isLoading && (
        <p className='font-medium'>No messages to show</p>
      )}

      <AdContainer slotId='7607907295' />

      {isLoading ? (
        <div className='mt-20 flex min-h-screen justify-center'>
          <span className='loader-2' />
        </div>
      ) : (
        children
      )}

      {!messages?.length && cursorId && !isLoading && (
        <div className='flex justify-center pt-24'>
          <button
            onClick={() => {
              setPageNo(1);
              setCursorId('');
            }}
            className='hover:underline'
            type='button'
          >
            &larr; Go back to latest messages
          </button>
        </div>
      )}

      {!isLoading && messages && messages?.length > 0 && (
        <div className={`flex ${cursorId ? 'justify-between' : 'justify-end'}`}>
          {cursorId && (
            <button
              className='hover:underline'
              onClick={() => {
                setPageNo(1);
                setCursorId('');
              }}
              type='button'
            >
              &larr; Latest
            </button>
          )}

          {cursorId && <p>{pageNo}</p>}

          {messages.length === 3 && (
            <button
              className='hover:underline'
              onClick={() => {
                setPageNo(cursorId ? pageNo + 1 : 2);
                setCursorId(messages?.length ? messages[2]?.id! : '');
              }}
              type='button'
            >
              More &rarr;
            </button>
          )}
        </div>
      )}

      <AdContainer slotId='7293553855' />
      <AdContainer slotId='4956732763' />
    </section>
  );
};
