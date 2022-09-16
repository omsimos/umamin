import React, { useState } from 'react';
import Image from 'next/image';
import { useQuery } from 'react-query';
import { RiSendPlaneFill } from 'react-icons/ri';

import { getSeenMessages } from '@/api';
import { ChatBubble } from '../ChatBubble';
import { InboxTabContainer } from './Container';
import { ReplyData, ReplyDialog } from '../Dialog';
import { useInbox } from '@/contexts/InboxContext';

export const Seen = () => {
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [openReply, setOpenReply] = useState(false);
  const [replyData, setMsgData] = useState({} as ReplyData);

  const { user } = useInbox();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const {
    data: messages,
    isLoading,
    refetch,
  } = useQuery(['seen_messages', queryArgs], () => getSeenMessages(queryArgs), {
    select: (data) => data.getMessages,
  });

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={messages}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <ReplyDialog
        refetch={refetch}
        isOpen={openReply}
        replyData={replyData}
        setIsOpen={setOpenReply}
      />

      {messages?.map((m) => (
        <div
          key={m.id}
          className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'
        >
          <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] py-1'>
            <div className='relative mx-auto h-[40px] w-[120px]'>
              <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
            </div>
          </div>

          {/* Message */}
          <div className='flex min-h-[170px] flex-col justify-between gap-4 px-5 pt-10 pb-3 sm:px-7 sm:pt-7 md:gap-3'>
            <ChatBubble type='sender' content={m.receiverMsg} />
            <ChatBubble type='receiver' content={m.content} />
            {m.reply && <ChatBubble type='sender' content={m.reply} />}
          </div>

          {/* Send Message */}
          {!m.reply && (
            <div className='py-5 px-4 md:px-5'>
              <button
                type='button'
                onClick={() => {
                  setMsgData(m);
                  setOpenReply(true);
                }}
                className='bg-secondary-100 flex w-full cursor-text items-center justify-between rounded-full py-3 px-5 md:py-2'
              >
                <p className='text-gray-400'>Reply...</p>
                <RiSendPlaneFill className='text-primary-100 cursor-pointer text-2xl lg:text-[1.35rem]' />
              </button>
            </div>
          )}
        </div>
      ))}
    </InboxTabContainer>
  );
};
