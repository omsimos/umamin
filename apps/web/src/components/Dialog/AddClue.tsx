import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { HiRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';

import { DialogContainer, DialogContainerProps } from '.';

type Options = 'message' | 'username' | '';

interface Props extends DialogContainerProps {
  clue: string;
  setClue: React.Dispatch<React.SetStateAction<string>>;
}

export const AddClueDialog = ({ clue, setClue, setIsOpen, ...rest }: Props) => {
  const [msgClue, setMsgClue] = useState('');
  const [randomUsername, setRandomUsername] = useState('');
  const [attachedClue, setAttachedClue] = useState<Options>('');
  const [currentOption, setCurrentOption] = useState<Options>('');

  const { data: session } = useSession();

  const closeDialog = () => {
    setIsOpen(false);
    setTimeout(() => {
      setCurrentOption('');
    }, 500);
  };

  const scrambleUsername = useCallback(() => {
    const scrambled = session?.user?.username
      ?.split('')
      .sort(() => 0.5 - Math.random())
      .join('');

    if (!session?.user?.username) {
      toast.error('Could not scramble username: try relogging');
    }

    return scrambled ?? '';
  }, [session?.user?.username]);

  return (
    <DialogContainer
      {...rest}
      transparent
      setIsOpen={setIsOpen}
      className='grid h-full place-items-center'
    >
      <div className='msg-card p-6'>
        {currentOption === '' && (
          <div className='flex flex-col'>
            <h2 className='font-semibold'>
              🧩 Select a clue to attach to your message
            </h2>
            <div className='line my-3' />
            <div className='space-y-3 [&>*]:clue-btn'>
              <button
                type='button'
                onClick={() => setCurrentOption('message')}
                className={
                  attachedClue === 'message'
                    ? 'border-primary-300'
                    : 'border-gray-500'
                }
              >
                Write a clue about your identity
              </button>
              <button
                type='button'
                onClick={() => {
                  setCurrentOption('username');
                  setRandomUsername(scrambleUsername());
                }}
                className={
                  attachedClue === 'username'
                    ? 'border-primary-300'
                    : 'border-gray-500'
                }
              >
                Attach scrambled username
              </button>
            </div>

            <p className='mt-8 text-gray-400 italic text-sm'>
              You can only add 1 type of clue
            </p>
            <button
              type='button'
              className='self-end'
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        )}

        {currentOption === 'message' && (
          <form className='flex flex-col'>
            <h2 className='font-semibold'>
              🧩 Write a clue about your identity
            </h2>
            <div className='line my-3' />

            <textarea
              required
              value={msgClue}
              onChange={(e) => setMsgClue(e.target.value)}
              maxLength={100}
              placeholder='Enter here...'
              className='bg-secondary-100 w-full h-[120px] outline-none py-3 px-4 rounded-md resize-none'
            />

            <div className='mt-8 flex items-center space-x-4 self-end'>
              <button type='button' onClick={() => setCurrentOption('')}>
                Go Back
              </button>

              <button
                type='button'
                className='primary-btn'
                onClick={() => {
                  if (clue.length > 0) {
                    setAttachedClue('message');
                    setClue(msgClue);
                  } else {
                    setAttachedClue('');
                    setClue('');
                  }

                  toast.success(
                    clue.length > 0 ? 'Clue added' : 'Clue removed'
                  );
                  closeDialog();
                }}
              >
                Save
              </button>
            </div>
          </form>
        )}

        {currentOption === 'username' && (
          <div className='flex flex-col'>
            <h2 className='font-semibold'>🧩 Scramble username</h2>
            <div className='line my-3' />

            <div className='flex space-x-2'>
              <p className='bg-secondary-100 w-full outline-none px-4 py-4 rounded-md'>
                {randomUsername}
              </p>

              <button
                type='button'
                onClick={() => setRandomUsername(scrambleUsername())}
                className='rounded-md bg-secondary-300 border-2 border-secondary-100 px-4 text-xl flex-none'
              >
                <HiRefresh />
              </button>
            </div>

            <div className='mt-8 flex items-center space-x-4 self-end'>
              <button type='button' onClick={() => setCurrentOption('')}>
                Go Back
              </button>

              <button
                type='button'
                className='primary-btn'
                onClick={() => {
                  if (attachedClue === 'username') {
                    setAttachedClue('');
                    setClue('');
                  } else {
                    setAttachedClue('username');
                    setClue(randomUsername);
                  }

                  toast.success(
                    `${
                      attachedClue === 'username' ? 'Detached' : 'Attached'
                    } scrambled username`
                  );

                  closeDialog();
                }}
              >
                {attachedClue === 'username' ? 'Detach' : 'Attach'}
              </button>
            </div>
          </div>
        )}
      </div>
    </DialogContainer>
  );
};
