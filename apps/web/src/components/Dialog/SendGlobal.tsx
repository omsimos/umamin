import React, { useState } from 'react';
import { Switch } from '@headlessui/react';
import { useInboxContext } from '@/contexts/InboxContext';

import { ImageFill } from '../Utils';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {}

export const SendGlobalModal = ({ setIsOpen, ...rest }: Props) => {
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { user } = useInboxContext();

  return (
    <DialogContainer transparent setIsOpen={setIsOpen} {...rest}>
      <form className='msg-card flex flex-col space-y-4 p-6'>
        <div>
          <div className='flex gap-x-2 mb-4 items-center'>
            <ImageFill
              alt='profile picture'
              src={user?.image}
              unoptimized
              className='border-secondary-100 h-[40px] w-[40px] object-cover rounded-full border flex-none'
            />
              <div>

            <p>{user?.username}</p>
            <p className='text-secondary-400 text-xs'>anyone can see your message</p>
            </div>
          </div>

          <textarea
            required
            minLength={1}
            maxLength={100}
            className='settings-input min-h-[100px] resize-none'
            value={message}
            placeholder="What's on your mind"
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button type='button' className='rounded py-2 bg-primary-200'>
          Post
        </button>

        <div className='self-end'>
          <div className='flex gap-x-2'>
            <p className='text-secondary-400'>anonymous</p>

            <Switch
              checked={isAnonymous}
              onChange={setIsAnonymous}
              className={`${isAnonymous ? 'bg-primary-200' : 'bg-secondary-400'}
          relative inline-flex h-[22px] w-[37px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-white focus-visible:ring-opacity-75`}
            >
              <span
                aria-hidden='true'
                className={`${isAnonymous ? 'translate-x-4' : 'translate-x-0'}
            pointer-events-none inline-block h-[17px] w-[17px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
              />
            </Switch>
          </div>
        </div>
      </form>
    </DialogContainer>
  );
};
