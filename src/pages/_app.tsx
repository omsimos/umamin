import React from 'react';
import '../styles/globals.css';
import 'nprogress/nprogress.css';
import Router from 'next/router';
import NProgress from 'nprogress';
import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider, Hydrate } from 'react-query';
import { SessionProvider } from 'next-auth/react';

import { queryClient } from '@/api';
import { Layout } from '@/components';

Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <Hydrate state={pageProps.dehydratedState}>
          <Layout>
            <Component {...pageProps} />
          </Layout>
          <Toaster />
        </Hydrate>
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default MyApp;
