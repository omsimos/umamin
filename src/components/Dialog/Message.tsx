import React from 'react';
import { BsInstagram } from 'react-icons/bs';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { nanoid } from 'nanoid';
import Link from 'next/link';

import { useLogEvent } from '@/hooks';
import type { Message } from '@/generated/graphql';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  username: string;
  data: Partial<Message>;
}

export const MessageDialog = ({
  username,
  data,
  setIsOpen,
  ...rest
}: Props) => {
  const triggerEvent = useLogEvent();

  const saveImage = async () => {
    const imgUrl = await toPng(document.getElementById('card-img')!);
    download(imgUrl, `${username}_${nanoid(5)}.png`);
  };

  return (
    <DialogContainer setIsOpen={setIsOpen} className='mt-12 lg:mt-32' {...rest}>
      <div className='mx-4 space-x-4'>
        <button
          onClick={() => setIsOpen(false)}
          className='lg:hidden'
          type='button'
        >
          &larr; Go Back
        </button>
      </div>
      <div id='card-img' className='flex flex-col bg-secondary-300 p-4'>
        <p className='mb-2 self-center font-syneExtrabold text-xl'>
          <span className='text-primary-200'>umamin</span>.link
        </p>

        <div className='msg-card overflow-hidden text-left'>
          <div className='receive chat-p max-w-full bg-secondary-100 px-6 py-5 font-interMedium text-lg text-white before:bg-secondary-100 after:bg-secondary-200'>
            <p className='reply mb-3'>{data.receiverMsg}</p>
            <p>{data.content}</p>
          </div>
        </div>
      </div>

      <div className='flex items-center justify-end space-x-4 px-4 lg:mt-4 lg:space-x-0'>
        <div className='flex items-start justify-between lg:w-full'>
          <button
            onClick={() => setIsOpen(false)}
            className='ml-4 hidden lg:block'
            type='button'
          >
            &larr; Go Back
          </button>

          <button
            className='hover:underline'
            type='button'
            onClick={() => {
              saveImage();
              triggerEvent('save_image');
            }}
          >
            Download
          </button>
        </div>

        <button
          className='primary-btn flex items-center space-x-2 lg:hidden'
          type='button'
          onClick={() => {
            saveImage();
            window.location.assign('instagram://story-camera');
            triggerEvent('share_image', { name: 'Instagram' });
          }}
        >
          <BsInstagram className='text-base' />
          <p>Share to Story</p>
        </button>
      </div>

      <div className='mt-4 w-full pr-4 text-right text-primary-100 lg:hidden'>
        <Link href='/help'>Need Help?</Link>
      </div>
    </DialogContainer>
  );
};
