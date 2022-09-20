import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export interface DialogContainerProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  transparent?: boolean;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const DialogContainer = ({
  isOpen,
  setIsOpen,
  transparent,
  onClose,
  className,
  children,
}: DialogContainerProps) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as='div'
        className={`fixed inset-0 z-20 ${
          transparent ? 'bg-secondary-300/90' : 'bg-secondary-300'
        }`}
        onClose={() => {
          setIsOpen(false);
          if (onClose) {
            onClose();
          }
        }}
      >
        <div className='fixed inset-0' />

        <div className='fixed inset-0 overflow-y-auto'>
          <div className='flex min-h-full items-center justify-center'>
            <Dialog.Panel
              className={`contain flex flex-col items-center ${className}`}
            >
              <Transition.Child
                enter='ease-out duration-300'
                enterFrom='opacity-0 scale-95'
                enterTo='opacity-100 scale-100'
                leave='ease-in duration-200'
                leaveFrom='opacity-100 scale-100'
                leaveTo='opacity-0 scale-95'
                className='w-full max-w-[500px]'
              >
                {children}
              </Transition.Child>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
