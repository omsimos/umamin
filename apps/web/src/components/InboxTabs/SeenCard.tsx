import React, { useState } from 'react';
import { HiDownload, HiTrash } from 'react-icons/hi';
import type { SeenMessage } from '@umamin/generated';
import { RiSendPlaneFill } from 'react-icons/ri';
import { useMutation } from 'react-query';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import download from 'downloadjs';

import { deleteMessage } from '@/api';
import { ImageFill } from '../ImageFill';
import { ChatBubble } from '../ChatBubble';
import { useInbox } from '@/contexts/InboxContext';
import { ConfirmDialog, ReplyDialog } from '../Dialog';

interface Props {
  refetch: () => void;
  message: SeenMessage;
}

export const SeenCard = ({ message, refetch }: Props) => {
  const { id, content, receiverMsg, reply } = message;
  const { user } = useInbox();

  const [deleteModal, setDeleteModal] = useState(false);
  const [replyModal, setReplyModal] = useState(false);

  const { mutate } = useMutation(deleteMessage);

  const handleDelete = () => {
    mutate(
      { id },
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
    const imgUrl = await toPng(document.getElementById(id)!);
    download(imgUrl, `${user?.username}_${id}.png`);
  };

  return (
    <>
      <ReplyDialog
        refetch={refetch}
        message={message}
        isOpen={replyModal}
        setIsOpen={setReplyModal}
      />

      <ConfirmDialog
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        content={<p>Are you sure you want to delete this message?</p>}
        handleConfirm={handleDelete}
      />

      <div
        id={id}
        className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'
      >
        <div className='border-secondary-100 relative flex items-center justify-between border-b-2 bg-[#171819] py-1'>
          <button
            type='button'
            onClick={() => setDeleteModal(true)}
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
            type='button'
            onClick={saveImage}
            className='absolute right-2 p-2 text-lg text-gray-400'
          >
            <HiDownload />
          </button>
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 px-5 pt-10 pb-3 sm:px-7 sm:pt-7 md:gap-3'>
          <ChatBubble type='sender' content={receiverMsg ?? ''} />
          <ChatBubble type='receiver' content={content ?? ''} />
          {reply && <ChatBubble type='sender' content={reply} />}
        </div>

        {/* Send Message */}
        {reply && (
          <div className='py-5 px-4 md:px-5'>
            <button
              type='button'
              className='bg-secondary-100 flex w-full cursor-text items-center justify-between rounded-full py-3 px-5 md:py-2'
            >
              <p className='text-gray-400'>Reply...</p>
              <RiSendPlaneFill className='text-primary-100 cursor-pointer text-2xl lg:text-[1.35rem]' />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
