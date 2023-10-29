import React, { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { BiLink } from 'react-icons/bi';
import { MdWindow } from 'react-icons/md';
import { TbLogout } from 'react-icons/tb';
import { signOut, useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { HiOutlineGlobeAlt, HiHome } from 'react-icons/hi';

import { useLogEvent } from '@/hooks';
import { useInboxContext } from '@/contexts/InboxContext';

import { ImageFill } from './Utils';
import { ConfirmDialog, SettingsDialog } from './Dialog';

export const BottomNavbar = () => {
  const { push } = useRouter();
  const [loading, setLoading] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [linkModal, setLinkModal] = useState(false);

  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();
  const { data, status } = useSession();

  const queryClient = useQueryClient();

  const copyLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/to/${user?.username}`
    );
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  const handleLogout = async () => {
    setLoading(true);
    await queryClient.invalidateQueries();
    await signOut({ redirect: false });
    push('/login');
    setLoading(false);
  };

  return (
    <>
      <SettingsDialog isOpen={settingsModal} setIsOpen={setSettingsModal} />
      <ConfirmDialog
        isOpen={linkModal}
        setIsOpen={setLinkModal}
        confirmText='Copy'
        handleConfirm={copyLink}
        content={
          <div>
            <p className='mb-4 text-secondary-400'>
              To change your link, simply update your username.
            </p>

            <div className='flex gap-x-2 items-center'>
              <ImageFill
                alt='profile picture'
                src={data?.user?.image}
                unoptimized
                className='border-secondary-100 h-[40px] w-[40px] object-cover rounded-full border'
              />
              <p className='border-secondary-100 rounded-lg border px-4 py-2 inline-block'>
                {window.location.host}/to/{user?.username}
              </p>
            </div>
          </div>
        }
      />

      <ConfirmDialog
        isOpen={logoutModal}
        setIsOpen={setLogoutModal}
        confirmText='Logout'
        danger
        content={<p>Are you sure you want to logout?</p>}
        handleConfirm={handleLogout}
      />
      <div className='bg-secondary-200 border-t-2 border-secondary-100 fixed w-full max-w-[470px] left-[50%] translate-x-[-50%] py-4 z-50 bottom-0 flex justify-evenly items-center mx-auto rounded-t-3xl'>
        <Link href='/inbox'>
          <HiHome className='text-2xl' />
        </Link>

        <button type='button' onClick={() => setLinkModal(true)}>
          <BiLink className='text-2xl' />
        </button>

        <button
          type='button'
          onClick={() => setSettingsModal(true)}
          className='p-3 rounded-full bg-primary-200'
        >
          <MdWindow className='text-3xl' />
        </button>

        <Link href='/global'>
          <HiOutlineGlobeAlt className='text-2xl' />
        </Link>

        {status === 'loading' || loading ? (
          <span className='loader' />
        ) : (
          <button type='button' onClick={() => setLogoutModal(true)}>
            <TbLogout className='text-xl' />
          </button>
        )}
      </div>
    </>
  );
};
