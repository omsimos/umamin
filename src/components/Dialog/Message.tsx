import React from 'react';
import { useMutation } from 'react-query';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { nanoid } from 'nanoid';

import { Info } from '@/components';
import { editMessage } from '@/api';
import { useLogEvent } from '@/hooks';
import type { Message } from '@/generated/graphql';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  username: string;
  data: Partial<Message>;
}

export const MessageDialog = ({ username, data, ...rest }: Props) => {
  const triggerEvent = useLogEvent();
  const { mutate } = useMutation(editMessage);

  const saveImage = async () => {
    const imgUrl = await toPng(document.getElementById('msg_card')!);
    download(imgUrl, `${username}_${nanoid(5)}.png`);

    if (data.id && !data.isDownloaded) {
      mutate({
        id: data.id,
        isDownloaded: true,
      });
    }

    triggerEvent('save_image');
  };

  return (
    <DialogContainer {...rest}>
      <Info
        className='mb-4 lg:hidden'
        message='Click outside the card to go back.'
      />
      <div
        id='msg_card'
        className='card overflow-hidden rounded-2xl px-7 py-5 text-left'
      >
        <p className='flex items-center justify-center pb-2  font-syne font-extrabold'>
          <span className='text-primary-200'>umamin</span>.link/to/
          {username}
        </p>

        <div className='receive chat-p max-w-full bg-secondary-100 px-6 py-5 font-medium text-white before:bg-secondary-100 after:bg-secondary-200'>
          <p className='reply mb-3'>{data.receiverMsg}</p>
          <p>{data.content}</p>
        </div>
      </div>

      <div className='mt-6 flex items-center justify-end space-x-4 lg:mt-4 lg:space-x-0'>
        <div className='flex items-start justify-between lg:w-full'>
          <Info
            className='hidden lg:flex'
            message='Click outside the card to go back.'
          />
          <button className='hover:underline' type='button' onClick={saveImage}>
            Download Image
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
