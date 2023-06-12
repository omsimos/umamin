import React, { useState, useRef, useCallback } from 'react';
import { HiDownload, HiPuzzle, HiTrash } from 'react-icons/hi';
import { useMutation } from 'react-query';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { nanoid } from 'nanoid';

import { useLogEvent } from '@/hooks';
import { deleteMessage } from '@/api';
import { useInboxContext } from '@/contexts/InboxContext';
import type { RecentMessage, SeenMessage } from '@umamin/generated';
import {
  ClueDialog,
  ConfirmDialog,
  DialogContainer,
  DialogContainerProps,
} from '.';

interface Props extends DialogContainerProps {
  refetch?: () => void;
  data: RecentMessage | SeenMessage;
}

export const MessageDialog = ({ data, setIsOpen, refetch, ...rest }: Props) => {
  const { id, content, clue, receiverMsg } = data;
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();
  const { mutate } = useMutation(deleteMessage);

  const [clueDialog, setClueDialog] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const saveImage = useCallback(() => {
    if (cardRef.current === null) {
      return;
    }

    toPng(cardRef.current, { cacheBust: true })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${user?.username}_${nanoid(5)}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        toast.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardRef]);

  const handleDelete = () => {
    mutate(
      { id },
      {
        onSuccess: () => {
          if (refetch) {
            refetch();
          }
          setIsOpen(false);
          setDeleteModal(false);
          toast.success('Message deleted');
        },
      }
    );

    triggerEvent('delete_message');
  };

  return (
    <>
      <ConfirmDialog
        danger
        confirmText='Delete'
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        content={<p>Are you sure you want to delete this message?</p>}
        handleConfirm={handleDelete}
      />

      {clue && (
        <ClueDialog isOpen={clueDialog} setIsOpen={setClueDialog} clue={clue} />
      )}

      <DialogContainer setIsOpen={setIsOpen} {...rest}>
        <section
          ref={cardRef}
          className='dark:bg-secondary-300 bg-gray-300 p-4'
        >
          <div className='dark:border-secondary-100 dark:bg-secondary-200 relative flex w-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border-2 border-gray-400 bg-gray-200 p-5'>
            {/* Message */}
            <p className='text-center text-lg font-bold'>{receiverMsg}</p>
            <div>
              <p className='chat-receive chat-p receive w-full px-8 py-5 text-lg'>
                {content}
              </p>
            </div>
          </div>
        </section>

        <div className='flex justify-between px-4 lg:w-full'>
          <button
            onClick={() => setIsOpen(false)}
            type='button'
            className='hover:underline'
          >
            &larr; Go Back
          </button>

          <div className='space-x-2 text-xl text-white'>
            {clue && (
              <button
                type='button'
                onClick={() => setClueDialog(true)}
                className='rounded bg-green-500 p-2'
              >
                <HiPuzzle />
              </button>
            )}
            <button
              type='button'
              onClick={() => setDeleteModal(true)}
              className='rounded bg-red-500 p-2'
            >
              <HiTrash />
            </button>
            <button
              className='bg-primary-200 rounded p-2'
              type='button'
              onClick={() => {
                saveImage();
                triggerEvent('save_image');
              }}
            >
              <HiDownload />
            </button>
          </div>
        </div>
      </DialogContainer>
    </>
  );
};
