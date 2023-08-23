import React, { useCallback, useRef } from 'react';
import Link from 'next/link';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';
import { toPng } from 'html-to-image';
import { MdVerified } from 'react-icons/md';
import { formatDistanceToNow } from 'date-fns';
import { GlobalMessage } from '@umamin/generated';
import { HiOutlineHeart, HiOutlineChat, HiOutlineSave } from 'react-icons/hi';

import { Container, ImageFill } from '../Utils';
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
        <div className='border border-secondary-100 p-8 bg-secondary-200 rounded-2xl'>
          <div className='flex gap-x-4'>
            <div className='relative'>
              <ImageFill
                alt='profile picture'
                src={message.isAnonymous ? '' : message.user?.image}
                unoptimized
                className='border-secondary-100 h-[45px] w-[45px] object-cover rounded-full border flex-none'
              />

              {!message.isAnonymous &&
                message.user &&
                message.user.username &&
                process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(',').includes(
                  message.user.username
                ) && (
                  <MdVerified className='text-sky-400 shadow-sm text-lg absolute right-0 top-7' />
                )}
            </div>

            <div>
              <div className='flex gap-x-2 items-center'>
                <p className='font-medium'>
                  {(message.isAnonymous
                    ? 'anonymous'
                    : message.user?.username) || 'anonymous'}
                </p>
                <p className='text-secondary-400 text-center text-sm'>
                  {formatDistanceToNow(new Date(message.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <p className='font-light mt-1 break-words max-w-[300px]'>
                {message.content}
              </p>
              <p className='text-secondary-400 text-sm mt-4'>
                umamin.link/global
              </p>
            </div>
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
          <button
            onClick={() => toast('Coming soon', { icon: 'ℹ️' })}
            className='pr-5'
            type='button'
          >
            <HiOutlineHeart />
          </button>

          {!message.isAnonymous && (
            <Link
              href={`/to/${message.user?.username}`}
              className='border-l border-secondary-100 px-5 '
            >
              <HiOutlineChat />
            </Link>
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
  );
};
