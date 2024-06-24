import React from 'react';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  clue: string;
}

export const ClueDialog = ({ clue, setIsOpen, ...rest }: Props) => {
  return (
    <DialogContainer
      transparent
      setIsOpen={setIsOpen}
      {...rest}
      className='grid h-full place-items-center'
    >
      <div className='msg-card flex flex-col p-6'>
        <p className='font-semibold'>🧩 You found a clue!</p>
        <div className='line my-3 ' />
        <div className='dark:bg-secondary-100 rounded-md bg-red-300 py-3 px-4 text-sm '>
          <p>{clue}</p>
        </div>

        {clue.length <= 12 && (
          <p className='mt-4 text-sm italic text-gray-400'>
            It could be a scrambled username!
          </p>
        )}

        <button
          type='button'
          className={`self-end ${clue.length > 12 && 'mt-8'}`}
          onClick={() => setIsOpen(false)}
        >
          Close
        </button>
      </div>
    </DialogContainer>
  );
};
