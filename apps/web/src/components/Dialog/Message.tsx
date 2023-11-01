import React, { useState, useRef, useCallback } from 'react';
import { HiOutlineSave, HiPuzzle, HiTrash } from 'react-icons/hi';
import { useMutation } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

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
import { Container } from '../Utils';

interface Props extends DialogContainerProps {
  refetch?: () => void;
  data: RecentMessage | SeenMessage;
  type: 'recent' | 'seen';
}

export const MessageDialog = ({
  data,
  type,
  setIsOpen,
  refetch,
  ...rest
}: Props) => {
  const { id, content, clue, receiverMsg } = data;
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();
  const { mutate } = useMutation({ mutationFn: deleteMessage });

  const [clueDialog, setClueDialog] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

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

      <DialogContainer setIsOpen={setIsOpen} container={false} {...rest}>
        <section ref={cardRef} className='bg-secondary-300 p-4'>
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

        <Container className='flex justify-between'>
          <button
            onClick={() => setIsOpen(false)}
            type='button'
            className='hover:underline'
          >
            &larr; Back
          </button>

          <div className='bg-secondary-200 text-2xl flex border-y border-secondary-100 rounded-full py-3 px-6'>
            {clue && (
              <button
                onClick={() => setClueDialog(true)}
                type='button'
                className='pr-5 '
              >
                <HiPuzzle />
              </button>
            )}

            {type === 'seen' && (
              <button
                onClick={() => toast('Coming soon', { icon: 'ℹ️' })}
                className={`border-secondary-100 ${
                  clue ? 'px-5 border-l' : 'pr-5'
                } `}
                type='button'
              >
                <HiTrash />
              </button>
            )}

            <button
              onClick={saveImage}
              className='border-l border-secondary-100 pl-5'
              type='button'
            >
              <HiOutlineSave />
            </button>
          </div>
        </Container>
      </DialogContainer>
    </>
  );
};
