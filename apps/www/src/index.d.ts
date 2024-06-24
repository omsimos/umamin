import type { NextPage } from 'next';
import type { ReactElement, ReactNode } from 'react';

/* eslint-disable no-unused-vars */
export {};

declare global {
  interface Window {
    adsbygoogle: any;
  }
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};
