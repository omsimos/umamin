import React from 'react';
import { QueryClientProvider, Hydrate } from 'react-query';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import type { AppProps } from 'next/app';
import { DefaultSeo } from 'next-seo';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import Router from 'next/router';

import '../styles/globals.css';
import { queryClient } from '@/api';
import { Maintenance } from '@/components';

import SEO from '../../next-seo-config';
import type { NextPageWithLayout } from '..';

Router.events.on('routeChangeStart', () => {
  NProgress.configure({ showSpinner: false });
  NProgress.start();
});
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

type AppPropsWithLayout = AppProps<{ session: any; dehydratedState: any }> & {
  Component: NextPageWithLayout;
};

function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page: React.ReactElement) => page);

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <Hydrate state={pageProps.dehydratedState}>
          <DefaultSeo {...SEO} />
          {process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' ? (
            <Maintenance />
          ) : (
            <>{getLayout(<Component {...pageProps} />)}</>
          )}
          <Toaster />
        </Hydrate>
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default MyApp;
