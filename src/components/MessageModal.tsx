import React, { Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toPng } from 'html-to-image';
import download from 'downloadjs';

import { Info } from '@/components';
import type { Message } from '@/generated/graphql';

interface Props {
  username: string;
  data: Partial<Message>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MessageModal = ({ username, data, isOpen, setIsOpen }: Props) => {
  const storyRef = useRef<HTMLAnchorElement>(null);
  const saveImage = async () => {
    const imgUrl = await toPng(document.getElementById('msg_card')!);
    download(imgUrl, `${username}_${data.id?.substring(0, 5)}.png`);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as='div'
        className='fixed inset-0 z-10 bg-secondary-300'
        onClose={() => setIsOpen(false)}
      >
        <div className='fixed inset-0' />
        <Dialog.Panel className='contain mt-32'>
          <Transition.Child
            enter='ease-out duration-300'
            enterFrom='opacity-0 scale-95'
            enterTo='opacity-100 scale-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100 scale-100'
            leaveTo='opacity-0 scale-95'
          >
            <Info
              className='mb-4'
              message='Click outside the card to go back.'
            />
            <div
              id='msg_card'
              className='card overflow-hidden rounded-2xl px-7 py-5 text-left sm:w-[500px]'
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

            <div className='mt-6 flex items-center justify-end space-x-4 lg:space-x-0'>
              <div>
                <button
                  className='hover:underline'
                  type='button'
                  onClick={saveImage}
                >
                  Download Image
                </button>
                <span> or</span>
              </div>

              <button
                className='primary-btn lg:hidden'
                type='button'
                onClick={() => {
                  saveImage();
                  storyRef.current?.click();
                }}
              >
                Share to Instagram Story
              </button>
            </div>

            <a
              ref={storyRef}
              href='instagram://story-camera'
              target='_blank'
              rel='noreferrer noopener'
              className='hidden'
            >
              Instagram Story
            </a>
          </Transition.Child>
        </Dialog.Panel>
      </Dialog>
    </Transition>
  );
};
