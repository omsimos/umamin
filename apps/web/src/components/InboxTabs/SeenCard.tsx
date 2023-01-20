import React, { useState, useRef, useCallback } from 'react';
import type { SeenMessage } from '@umamin/generated';
import { formatDistanceToNow } from 'date-fns';
import { useMutation } from 'react-query';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import {
  HiAnnotation,
  HiDotsHorizontal,
  HiDownload,
  HiReply,
  HiTrash,
} from 'react-icons/hi';

import { deleteMessage } from '@/api';
import { useLogEvent } from '@/hooks';
import { useInboxContext } from '@/contexts/InboxContext';

import { Menu } from '../Menu';
import { ChatBubble } from '../ChatBubble';
import { ConfirmDialog, MessageDialog, ReplyDialog } from '../Dialog';

interface Props {
  refetch: () => void;
  message: SeenMessage;
}

export const SeenCard = ({ message, refetch }: Props) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { id, content, receiverMsg, reply, createdAt } = message;
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();

  const [deleteModal, setDeleteModal] = useState(false);
  const [replyModal, setReplyModal] = useState(false);
  const [cardModal, setCardModal] = useState(false);

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

    triggerEvent('delete_message');
  };

  const saveImage = useCallback(() => {
    if (cardRef.current === null) {
      return;
    }

    toPng(cardRef.current, { cacheBust: true })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${user?.username}_${id}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        toast.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardRef]);

  return (
    <>
      <ReplyDialog
        refetch={refetch}
        message={message}
        isOpen={replyModal}
        setIsOpen={setReplyModal}
      />

      <ConfirmDialog
        confirmText='Delete'
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        content={<p>Are you sure you want to delete this message?</p>}
        handleConfirm={handleDelete}
      />

      <MessageDialog
        data={message}
        isOpen={cardModal}
        setIsOpen={setCardModal}
      />

      <div
        ref={cardRef}
        className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 mb-6'
      >
        <div className='border-secondary-100 relative flex items-center border-b-2 bg-[#171819] py-3'>
          <button
            type='button'
            onClick={saveImage}
            className='absolute left-4 p-2 text-base text-gray-300'
          >
            <HiDownload />
          </button>

          <h3 className='font-syneExtrabold text-primary-200 mx-auto text-base'>
            umamin
          </h3>

          <Menu
            className='z-10'
            panelStyles='top-11 right-2 shadow-lg'
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
                  onClick={() => setCardModal(true)}
                  className='menu-item'
                >
                  <HiAnnotation />
                  <p>Card</p>
                </button>

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

        <p className='text-secondary-400 text-sm font-medium italic text-center pb-4'>
          {formatDistanceToNow(new Date(createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </>
  );
};
