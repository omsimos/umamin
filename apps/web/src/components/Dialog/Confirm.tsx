import React from 'react';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  content: React.ReactNode;
  handleConfirm: () => void;
}

export const ConfirmDialog = ({
  content,
  handleConfirm,
  setIsOpen,
  ...rest
}: Props) => {
  return (
    <DialogContainer
      transparent
      setIsOpen={setIsOpen}
      {...rest}
      className='grid h-full place-items-center'
    >
      <div className='msg-card flex flex-col p-6'>
        {content}
        <div className='mt-8 flex items-center space-x-4 self-end'>
          <button type='button' onClick={() => setIsOpen(false)}>
            Cancel
          </button>

          <button className='red-btn' type='button' onClick={handleConfirm}>
            Delete
          </button>
        </div>
      </div>
    </DialogContainer>
  );
};
