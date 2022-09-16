import React, { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { HiTrash, HiDownload } from 'react-icons/hi';
import { RiSendPlaneFill } from 'react-icons/ri';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import download from 'downloadjs';

import { ImageFill } from '../ImageFill';
import { ChatBubble } from '../ChatBubble';
import { InboxTabContainer } from './Container';
import { useInbox } from '@/contexts/InboxContext';
import { deleteMessage, getSeenMessages } from '@/api';
import { ConfirmDialog, ReplyData, ReplyDialog } from '../Dialog';

export const Seen = () => {
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [openReply, setOpenReply] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [msgData, setMsgData] = useState({} as ReplyData);

  const { user } = useInbox();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const {
    data: messages,
    isLoading,
    refetch,
  } = useQuery(['seen_messages', queryArgs], () => getSeenMessages(queryArgs), {
    select: (data) => data.getMessages,
  });

  const { mutate } = useMutation(deleteMessage);

  const handleDelete = () => {
    mutate(
      { id: msgData.id },
      {
        onSuccess: () => {
          refetch();
          setDeleteModal(false);
          toast.success('Message deleted');
        },
      }
    );
  };

  const saveImage = async () => {
    const imgUrl = await toPng(document.getElementById(msgData.id)!);
    download(imgUrl, `${user?.username}_${msgData.id}.png`);
  };

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
        replyData={msgData}
        setIsOpen={setOpenReply}
      />

      <ConfirmDialog
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        content={<p>Are you sure you want to delete this message?</p>}
        handleConfirm={handleDelete}
      />

      {messages?.map((m) => (
        <div
          id={m.id}
          key={m.id}
          className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'
        >
          <div className='border-secondary-100 relative flex items-center justify-between border-b-2 bg-[#171819] py-1'>
            <button
              onClick={() => {
                setMsgData(m);
                setDeleteModal(true);
              }}
              type='button'
              className='absolute left-2 p-2 text-lg text-gray-400'
            >
              <HiTrash />
            </button>

            <ImageFill
              src='/assets/logo.svg'
              objectFit='contain'
              className='mx-auto h-[40px] w-[120px]'
            />

            <button
              onClick={() => {
                setMsgData(m);

                setTimeout(() => {
                  saveImage();
                });
              }}
              type='button'
              className='absolute right-2 p-2 text-lg text-gray-400'
            >
              <HiDownload />
            </button>
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
