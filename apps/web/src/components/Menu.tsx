import React, { Fragment, ReactNode } from 'react';
import { Popover, Transition } from '@headlessui/react';

interface Props {
  className?: string;
  panelStyles?: string;
  button: ReactNode;
  panel: ReactNode;
}

export const Menu = ({ className, panelStyles, button, panel }: Props) => {
  return (
    <Popover className={`${className} relative`}>
      <Popover.Button className='text-2xl outline-none'>
        {button}
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
        <Popover.Panel
          className={`${panelStyles} border-secondary-100 bg-secondary-200 absolute flex w-[150px] flex-col space-y-2 rounded border-2 p-2`}
        >
          {panel}
        </Popover.Panel>
      </Transition>
    </Popover>
  );
};
