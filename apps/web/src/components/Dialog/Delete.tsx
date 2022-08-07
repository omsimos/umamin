import React from 'react';
import toast from 'react-hot-toast';
import { useMutation } from 'react-query';

import { deleteMessage, queryClient } from '@/api';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  id?: string;
  content?: string;
}

export const DeleteDialog = ({ id, content, setIsOpen, ...rest }: Props) => {
  const { mutate } = useMutation(deleteMessage);

  const handleDelete = () => {
    if (id) {
      mutate(
        { id },
        {
          onSuccess: () => {
            setIsOpen(false);
            toast.success('Message deleted');
            queryClient.invalidateQueries('messages');
          },
        }
      );
    }
  };
  return (
    <DialogContainer
      transparent
      setIsOpen={setIsOpen}
      {...rest}
      className='grid h-full place-items-center'
    >
      <div className='msg-card flex flex-col p-6'>
        <p className='reply mb-2'>{content}</p>
        <p>Are you sure you want to delete this message?</p>
        <div className='mt-8 flex items-center space-x-4 self-end'>
          <button type='button' onClick={() => setIsOpen(false)}>
            Cancel
          </button>

          <button className='red-btn' type='button' onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>
    </DialogContainer>
  );
};
