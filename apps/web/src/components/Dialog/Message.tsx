import React, { useRef, useCallback } from 'react';
import { useInboxContext } from '@/contexts/InboxContext';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { nanoid } from 'nanoid';

import { useLogEvent } from '@/hooks';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  data: {
    receiverMsg: string;
    content: string;
  };
}

export const MessageDialog = ({ data, setIsOpen, ...rest }: Props) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();

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

  return (
    <DialogContainer setIsOpen={setIsOpen} {...rest}>
      <div ref={cardRef} className='bg-secondary-300 flex flex-col p-4'>
        <p className='font-syneExtrabold mb-2 self-center text-xl'>
          <span className='text-primary-200'>umamin</span>.link
        </p>

        <div className='msg-card overflow-hidden text-left'>
          <div className='receive chat-p bg-secondary-100 before:bg-secondary-100 after:bg-secondary-200 max-w-full px-6 py-5 text-lg text-white'>
            <p className='reply font-interMedium mb-3'>{data.receiverMsg}</p>
            <p>{data.content}</p>
          </div>
        </div>
      </div>

      <div className='flex justify-between px-4 lg:w-full'>
        <button
          onClick={() => setIsOpen(false)}
          type='button'
          className='hover:underline'
        >
          &larr; Go Back
        </button>

        <button
          className='primary-btn'
          type='button'
          onClick={() => {
            saveImage();
            triggerEvent('save_image');
          }}
        >
          Download
        </button>
      </div>
    </DialogContainer>
  );
};
