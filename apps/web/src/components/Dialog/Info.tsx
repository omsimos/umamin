import React from 'react';
import { DialogContainer, DialogContainerProps } from '.';

export const Info = ({ setIsOpen, ...rest }: DialogContainerProps) => {
  return (
    <DialogContainer
      transparent
      setIsOpen={setIsOpen}
      {...rest}
      className='grid h-full place-items-center'
    >
      <div className='msg-card flex flex-col p-6'>
        <h1 className='text-base font-semibold'>📢 Announcement</h1>
        <div className='line my-3' />
        <p>
          We are back online! Thank you for your patience and support of umamin!
          Nothing new yet, but a huge update is coming this September. This
          upcoming update will, unfortunately, reset all data. You may
          screenshot/save the messages you want to keep before the update.
        </p>

        <button
          className='primary-btn mt-6'
          type='button'
          onClick={() => setIsOpen(false)}
        >
          Gotcha!
        </button>
      </div>
    </DialogContainer>
  );
};
