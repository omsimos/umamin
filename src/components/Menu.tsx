import React, { Fragment } from 'react';
import { BiUserCircle, BiLogInCircle } from 'react-icons/bi';
import { Popover, Transition } from '@headlessui/react';
import { HiMenuAlt3 } from 'react-icons/hi';
import Link from 'next/link';

export const Menu = () => {
  return (
    <Popover className='relative z-50 sm:hidden'>
      <Popover.Button className='text-2xl outline-none'>
        <HiMenuAlt3 />
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
        <Popover.Panel className='absolute top-8 right-0 flex w-[150px] flex-col space-y-2 rounded border-2 border-secondary-100 bg-secondary-200 p-2'>
          <Link href='/login'>
            <div className='menu-item'>
              <BiLogInCircle className='text-base' />
              <p>Login</p>
            </div>
          </Link>

          <Link href='/create'>
            <div className='menu-item'>
              <BiUserCircle className='text-base' />
              <p>Get started</p>
            </div>
          </Link>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
};
