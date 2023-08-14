import React, { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';
import { toPng } from 'html-to-image';
import { HiDownload } from 'react-icons/hi';
import { formatDistanceToNow } from 'date-fns';
import { GlobalMessage } from '@umamin/generated';

import { ImageFill } from '../Utils';
import { DialogContainer, DialogContainerProps } from './Container';

interface Props extends DialogContainerProps {
  message: GlobalMessage;
}

export const GlobalMsg = ({ setIsOpen, message, ...rest }: Props) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const saveImage = useCallback(() => {
    toast('Downloading image', { icon: '📥' });

    if (cardRef.current === null) {
      return;
    }

    toPng(cardRef.current, { cacheBust: true })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${message?.user?.username}_${nanoid(5)}.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Image downloaded');
      })
      .catch((err) => {
        toast.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardRef]);

  return (
    <DialogContainer setIsOpen={setIsOpen} container={false} {...rest}>
      <section ref={cardRef} className='bg-secondary-300 p-6'>
        <div className='border border-secondary-100 p-8 bg-secondary-200 rounded-lg'>
          <div className='flex gap-x-4'>
            <ImageFill
              alt='profile picture'
              src={message.isAnonymous ? '' : message.user?.image}
              unoptimized
              className='border-secondary-100 h-[45px] w-[45px] object-cover rounded-full border flex-none'
            />

            <div>
              <div className='flex gap-x-2 items-center'>
                <p className='font-medium'>
                  {(message.isAnonymous
                    ? 'anonymous'
                    : message.user?.username) || 'anonymous'}
                </p>
                <p className='text-secondary-400 text-center text-sm'>
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <p className='font-light mt-1'>{message.content}</p>
          <p className='text-secondary-400 text-xs mt-4'>umamin.link/global</p>
            </div>
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
          <button
            onClick={saveImage}
            className='bg-primary-200 rounded p-2'
            type='button'
          >
            <HiDownload />
          </button>
        </div>
      </div>
    </DialogContainer>
  );
};
