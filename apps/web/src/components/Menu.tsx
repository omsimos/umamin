import React, { Fragment } from 'react';
import { BiUserCircle, BiLogInCircle, BiLogOutCircle } from 'react-icons/bi';
import { Popover, Transition } from '@headlessui/react';
import { useSession } from 'next-auth/react';
import { HiMenuAlt3 } from 'react-icons/hi';
import { FaDiscord } from 'react-icons/fa';
import Link from 'next/link';

interface Props {
  handleLogout: () => void;
  loading: boolean;
}

export const Menu = ({ handleLogout, loading }: Props) => {
  const { status } = useSession();

  return (
    <Popover className='relative z-50 sm:hidden'>
      <Popover.Button className='text-2xl outline-none'>
        {status === 'loading' || loading ? (
          <span className='loader' />
        ) : (
          <HiMenuAlt3 className='transition-colors hover:text-gray-300' />
        )}
      </Popover.Button>

      <Transition
        as={Fragment}
        enter='transition ease-out duration-200'
        enterFrom='opacity-0 translate-y-1'
        enterTo='opacity-100 translate-y-0'
        leave='transition ease-in duration-150'
        leaveFrom='opacity-100 translate-y-0'
        leaveTo='opacity-0 translate-y-1'
      >
        <Popover.Panel className='border-secondary-100 bg-secondary-200 absolute top-8 right-0 flex w-[150px] flex-col space-y-2 rounded border-2 p-2'>
          {status === 'authenticated' ? (
            <button onClick={handleLogout} type='button' className='menu-item'>
              <BiLogOutCircle className='text-base' />
              <p>Logout</p>
            </button>
          ) : (
            <>
              <Link href='/login'>
                <div className='menu-item'>
                  <BiLogInCircle className='text-base' />
                  <p>Login</p>
                </div>
              </Link>

              <Link href='/register'>
                <div className='menu-item'>
                  <BiUserCircle className='text-base' />
                  <p>Get started</p>
                </div>
              </Link>
            </>
          )}
          <a
            href='https://discord.gg/bQKG7axhcF'
            target='_blank'
            rel='noreferrer noopener'
            className='menu-item'
          >
            <FaDiscord className='text-base' />
            <p>Discord</p>
          </a>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
};
