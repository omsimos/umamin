import React from 'react';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  content: React.ReactNode;
  handleConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const ConfirmDialog = ({
  content,
  handleConfirm,
  confirmText,
  cancelText = 'Cancel',
  setIsOpen,
  onClose,
  danger = false,
  ...rest
}: Props) => {
  return (
    <DialogContainer
      transparent
      onClose={onClose}
      setIsOpen={setIsOpen}
      {...rest}
      className='grid h-full place-items-center'
    >
      <div className='msg-card flex flex-col p-6'>
        {content}
        <div className='mt-8 flex items-center space-x-4 self-end'>
          <button
            type='button'
            onClick={() => {
              if (onClose) {
                onClose();
              }
              setIsOpen(false);
            }}
          >
            {cancelText}
          </button>

          {confirmText && (
            <button
              className={danger ? 'red-btn' : 'primary-btn'}
              type='button'
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </DialogContainer>
  );
};
