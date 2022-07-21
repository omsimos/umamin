import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

import { Info } from '@/components';
import type { Message } from '@/generated/graphql';

interface Props {
  username: string;
  data: Partial<Message>;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MessageModal = ({ username, data, isOpen, setIsOpen }: Props) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as='div'
        className='fixed inset-0 z-20 bg-secondary-300'
        onClose={() => setIsOpen(false)}
      >
        <div className='fixed inset-0' />
        <Dialog.Panel className='grid min-h-screen place-items-center px-4 text-center'>
          <Transition.Child
            enter='ease-out duration-300'
            enterFrom='opacity-0 scale-95'
            enterTo='opacity-100 scale-100'
            leave='ease-in duration-200'
            leaveFrom='opacity-100 scale-100'
            leaveTo='opacity-0 scale-95'
          >
            <div className='card overflow-hidden rounded-2xl px-7 py-5 text-left sm:w-[500px]'>
              <p className='flex items-center justify-center pb-2  font-syne font-extrabold'>
                <span className='text-primary-200'>umamin</span>.link/to/
                {username}
              </p>

              <div className='receive chat-p max-w-full bg-secondary-100 px-6 py-5 text-base font-medium text-white before:bg-secondary-100 after:bg-secondary-200'>
                <p className='reply mb-3'>{data.receiverMsg}</p>
                <p>{data.content}</p>
              </div>
            </div>
            <Info
              message='Click outside the card to go back.'
              className='mt-6'
            />
          </Transition.Child>
        </Dialog.Panel>
      </Dialog>
    </Transition>
  );
};
