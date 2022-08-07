import React, { useState } from 'react';
import type { Message } from '@umamin/generated';
import { BsTrashFill } from 'react-icons/bs';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { nanoid } from 'nanoid';

import { useLogEvent } from '../../hooks';
import { DialogContainer, DialogContainerProps, DeleteDialog } from '.';

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
  const [deleteModal, setDeleteModal] = useState(false);

  const saveImage = async () => {
    const imgUrl = await toPng(document.getElementById('card-img')!);
    download(imgUrl, `${username}_${nanoid(5)}.png`);
  };

  return (
    <>
      <DeleteDialog
        id={data.id}
        content={data.content}
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
      />
      <DialogContainer
        setIsOpen={setIsOpen}
        className='mt-12 lg:mt-32'
        {...rest}
      >
        <div className='mx-4 space-x-4'>
          <button
            onClick={() => setIsOpen(false)}
            className='lg:hidden'
            type='button'
          >
            &larr; Go Back
          </button>
        </div>
        <div id='card-img' className='bg-secondary-300 flex flex-col p-4'>
          <p className='font-syneExtrabold mb-2 self-center text-xl'>
            <span className='text-primary-200'>umamin</span>.link
          </p>

          <div className='msg-card overflow-hidden text-left'>
            <div className='receive chat-p bg-secondary-100 font-interMedium before:bg-secondary-100 after:bg-secondary-200 max-w-full px-6 py-5 text-lg text-white'>
              <p className='reply mb-3'>{data.receiverMsg}</p>
              <p>{data.content}</p>
            </div>
          </div>
        </div>

        <div className='flex items-center justify-end space-x-4 px-4 lg:mt-4'>
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
            onClick={() => {
              setIsOpen(false);

              setTimeout(() => {
                setDeleteModal(true);
              }, 500);
            }}
            className='flex items-center space-x-2 red-btn'
            type='button'
          >
            <BsTrashFill className='text-base' />
            <p>Delete</p>
          </button>
        </div>
      </DialogContainer>
    </>
  );
};
