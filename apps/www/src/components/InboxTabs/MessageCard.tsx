import React, { useState, useRef, useCallback } from 'react';
import type { Message } from '@umamin/generated';
import { useMutation } from '@tanstack/react-query';
import { HiPuzzlePiece } from 'react-icons/hi2';
import { formatDistanceToNow } from 'date-fns';
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
import {
  ClueDialog,
  ConfirmDialog,
  MessageDialog,
  ReplyDialog,
} from '../Dialog';

interface Props {
  refetch: () => void;
  message?: Message;
}

export const MessageCard = ({ message, refetch }: Props) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { id, content, clue, receiverMsg, reply, createdAt } = message ?? {};
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();

  const [clueDialog, setClueDialog] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [replyModal, setReplyModal] = useState(false);
  const [cardModal, setCardModal] = useState(false);

  const { mutate } = useMutation({ mutationFn: deleteMessage });

  const handleDelete = () => {
    if (id) {
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
    }
  };

  const saveImage = useCallback(() => {
    if (cardRef.current === null) {
      return;
    }

    toast.promise(
      toPng(cardRef.current, { cacheBust: true, pixelRatio: 3 })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `${user?.username}_${id}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          toast.error(err);
        }),
      {
        loading: 'Saving image...',
        success: 'Image saved',
        error: 'Failed to save image',
      }
    );

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
        danger
        confirmText='Delete'
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        content={<p>Are you sure you want to delete this message?</p>}
        handleConfirm={handleDelete}
      />

      <MessageDialog
        type='seen'
        data={message}
        refetch={refetch}
        isOpen={cardModal}
        setIsOpen={setCardModal}
      />

      {clue && (
        <ClueDialog isOpen={clueDialog} setIsOpen={setClueDialog} clue={clue} />
      )}

      <div ref={cardRef} className='p-6 bg-secondary-300'>
        <div className='border-secondary-100 bg-secondary-200 relative w-full overflow-hidden rounded-2xl border-2'>
          <div className='border-secondary-100 relative flex items-center border-b-2 py-3 bg-[#171819]'>
            <button
              type='button'
              onClick={saveImage}
              className='text-secondary-200 absolute left-4 p-2 text-base dark:text-gray-300'
            >
              <HiDownload />
            </button>

            <h3 className='font-syne font-extrabold text-primary-200 mx-auto text-base'>
              umamin
            </h3>

            <Menu
              className='z-10'
              panelStyles='top-11 right-2 shadow-lg'
              button={
                <HiDotsHorizontal className='text-secondary-200 absolute right-4 top-0 dark:text-gray-300' />
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
                    <p>View</p>
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

          <p className='text-secondary-400 pb-4 text-center text-sm font-medium italic'>
            {formatDistanceToNow(new Date(createdAt), {
              addSuffix: true,
            })}
          </p>

          <div className='absolute right-3 bottom-3 space-x-4 text-lg'>
            {clue && (
              <button
                type='button'
                onClick={() => setClueDialog(true)}
                className='rounded-full bg-[#456D51] text-[#4DF000] p-2'
              >
                <HiPuzzlePiece />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
