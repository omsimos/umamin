import React from 'react';
import { useMutation } from 'react-query';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { nanoid } from 'nanoid';
import Image from 'next/image';

import { editMessage } from '@/api';
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
  const { mutate } = useMutation(editMessage);

  const saveImage = async () => {
    const imgUrl = await toPng(document.getElementById('card-img')!);
    download(imgUrl, `${username}_${nanoid(5)}.png`);

    if (data.id && !data.isDownloaded) {
      mutate({
        id: data.id,
        isDownloaded: true,
      });
    }
  };

  return (
    <DialogContainer setIsOpen={setIsOpen} className='mt-12' {...rest}>
      <button
        onClick={() => setIsOpen(false)}
        className='ml-4 lg:hidden'
        type='button'
      >
        &larr; Go Back
      </button>
      <div id='card-img' className='flex flex-col bg-secondary-300 p-4'>
        <div className='mb-2 flex items-center self-center font-syneExtrabold text-xl'>
          <Image
            src='/assets/logo.svg'
            objectFit='contain'
            width={135}
            height={40}
          />
          <p>.link</p>
        </div>

        <div className='msg-card overflow-hidden text-left'>
          <div className='receive chat-p max-w-full bg-secondary-100 px-6 py-5 font-interMedium text-lg font-medium text-white before:bg-secondary-100 after:bg-secondary-200'>
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
          className='primary-btn lg:hidden'
          type='button'
          onClick={() => {
            saveImage();
            window.location.assign('instagram://story-camera');
            triggerEvent('share_image', { name: 'Instagram' });
          }}
        >
          Share to Instagram Story
        </button>
      </div>
    </DialogContainer>
  );
};
