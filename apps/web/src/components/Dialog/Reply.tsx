import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { RiSendPlaneFill } from 'react-icons/ri';
import { useMutation } from '@tanstack/react-query';
import type { SeenMessage } from '@umamin/generated';

import { addReply } from '@/api';
import { useLogEvent } from '@/hooks';
import { ChatBubble } from '../ChatBubble';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  refetch: () => void;
  message: SeenMessage;
}

export const ReplyDialog = ({
  refetch,
  message,
  onClose,
  setIsOpen,
  ...rest
}: Props) => {
  const [reply, setReply] = useState('');
  const triggerEvent = useLogEvent();

  const { mutate } = useMutation(addReply);

  const handleReply: React.FormEventHandler = (e) => {
    e.preventDefault();

    mutate(
      {
        id: message.id,
        content: reply,
      },
      {
        onSuccess: () => {
          refetch();
          setIsOpen(false);

          setTimeout(() => {
            setReply('');
          }, 500);

          toast.success('Reply sent');
          triggerEvent('reply');
        },
      }
    );
  };

  return (
    <DialogContainer
      {...rest}
      transparent
      setIsOpen={setIsOpen}
      onClose={() => {
        setTimeout(() => {
          setReply('');
        }, 500);
      }}
    >
      <div className='dark:border-secondary-100 dark:bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 border-gray-400 bg-gray-200'>
        <div className='dark:border-secondary-100 border-b-2 border-gray-400 bg-gray-300 py-3 dark:bg-[#171819]'>
          <h3 className='font-syneExtrabold text-primary-200 text-center text-base'>
            umamin
          </h3>
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 px-5 pt-10 pb-3 sm:px-7 sm:pt-7 md:gap-3'>
          <ChatBubble type='sender' content={message.receiverMsg} />
          <ChatBubble type='receiver' content={message.content} />
        </div>

        {/* Send Message */}
        <form
          onSubmit={handleReply}
          className='relative flex items-center justify-between py-5 px-4 md:px-5'
        >
          <input
            required
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            minLength={3}
            maxLength={200}
            type='text'
            placeholder='Reply...'
            className='dark:bg-secondary-100 w-full rounded-full bg-gray-300 py-3 px-5 pr-12 outline-none transition-all md:py-2'
          />

          <button
            type='submit'
            className='text-primary-100 absolute right-9 cursor-pointer text-2xl transition-all md:right-10 lg:text-[1.35rem]'
          >
            <RiSendPlaneFill />
          </button>
        </form>
      </div>
    </DialogContainer>
  );
};
