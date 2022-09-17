import React, { useState } from 'react';
import { HiDotsHorizontal, HiDownload, HiReply, HiTrash } from 'react-icons/hi';
import type { SeenMessage } from '@umamin/generated';
import { useMutation } from 'react-query';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import download from 'downloadjs';

import { Menu } from '../Menu';
import { deleteMessage } from '@/api';
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
        <div className='border-secondary-100 relative flex items-center border-b-2 bg-[#171819] py-3'>
          <button
            type='button'
            onClick={saveImage}
            className='absolute left-4 p-2 text-base text-gray-300'
          >
            <HiDownload />
          </button>

          <p className='font-syneExtrabold text-primary-200 mx-auto text-base'>
            umamin
          </p>

          <Menu
            className='z-10'
            panelStyles='top-11 right-2'
            button={
              <HiDotsHorizontal className='absolute right-4 top-0 text-gray-300' />
            }
            panel={
              <>
                {!reply && (
                  <button
                    type='button'
                    onClick={() => setReplyModal(true)}
                    className='menu-item'
                  >
                    <HiReply />
                    <p>Reply</p>
                  </button>
                )}

                <button
                  type='button'
                  onClick={() => setDeleteModal(true)}
                  className='menu-item'
                >
                  <HiTrash />
                  <p>Delete</p>
                </button>
              </>
            }
          />
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 px-5 pt-10 pb-3 sm:px-7 sm:pt-7 md:gap-3'>
          <ChatBubble type='sender' content={receiverMsg ?? ''} />
          <ChatBubble type='receiver' content={content ?? ''} />
          {reply && <ChatBubble type='sender' content={reply} />}
        </div>
      </div>
    </>
  );
};
