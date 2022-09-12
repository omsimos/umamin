import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation } from 'react-query';
import { Message } from '@umamin/generated';
import { RiSendPlaneFill } from 'react-icons/ri';

import { addReply } from '@/api';
import { useLogEvent } from '@/hooks';
import { ImageFill } from '../ImageFill';
import { ChatBubble } from '../ChatBubble';
import { DialogContainer, DialogContainerProps } from '.';

export type ReplyData = Pick<Message, 'id' | 'content' | 'receiverMsg'>;

interface Props extends DialogContainerProps {
  replyData: ReplyData;
  refetch: () => void;
}

export const ReplyDialog = ({
  replyData,
  refetch,
  onClose,
  setIsOpen,
  ...rest
}: Props) => {
  const [message, setMessage] = useState('');
  const triggerEvent = useLogEvent();

  const { mutate } = useMutation(addReply);

  const handleReply: React.FormEventHandler = (e) => {
    e.preventDefault();

    mutate(
      {
        id: replyData.id,
        content: message,
      },
      {
        onSuccess: () => {
          refetch();
          setIsOpen(false);

          setTimeout(() => {
            setMessage('');
          }, 500);

          toast.success('Reply sent');
          triggerEvent('open_message');
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
          setMessage('');
        }, 500);
      }}
      className='grid h-full place-items-center'
    >
      <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'>
        <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] py-1'>
          <ImageFill
            src='/assets/logo.svg'
            objectFit='contain'
            className='relative mx-auto h-[40px] w-[120px]'
          />
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 px-5 pt-10 pb-3 sm:px-7 sm:pt-7 md:gap-3'>
          <ChatBubble type='sender' content={replyData.receiverMsg} />
          <ChatBubble type='receiver' content={replyData.content} />
        </div>

        {/* Send Message */}
        <form
          onSubmit={handleReply}
          className='relative flex items-center justify-between py-5 px-4 md:px-5'
        >
          <input
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minLength={3}
            maxLength={200}
            type='text'
            placeholder='Reply...'
            className='bg-secondary-100 w-full rounded-full py-3 px-5 pr-12 outline-none transition-all md:py-2'
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
