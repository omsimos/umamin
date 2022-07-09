import React from 'react';
import Link from 'next/link';

const Create = () => {
  return (
    <section className='flex flex-col items-center gap-8'>
      <h1 className='h1-text'>Create your profile</h1>
      <div className='flex w-full flex-col justify-center gap-3 md:flex-row'>
        <div className='relative md:w-[50%]'>
          <input
            type='text'
            placeholder='Enter a name for your link'
            className='w-full rounded bg-secondary-100 py-3 px-4 text-sm md:text-base'
          />
          <div className='absolute mt-2 hidden gap-2 text-sm md:flex'>
            <p>Already have an account?</p>
            <Link href='login'>
              <a className='text-primary-100'>Login</a>
            </Link>
          </div>
        </div>

        <button type='button' className='primary-btn'>
          Check availability
        </button>

        <div className='flex gap-2 self-end text-sm md:hidden'>
          <p>Already have an account?</p>
          <Link href='login'>
            <a className='text-primary-100'>Login</a>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Create;
