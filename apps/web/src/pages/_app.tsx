import React from 'react';
import { QueryClientProvider, Hydrate } from 'react-query';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import type { AppProps } from 'next/app';
import { DefaultSeo } from 'next-seo';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import Router from 'next/router';
import Script from 'next/script';

import '../styles/globals.css';
import { queryClient } from '@/api';
import { Layout, Maintenance } from '@/components';
import SEO from '../../next-seo-config';

Router.events.on('routeChangeStart', () => {
  NProgress.configure({ showSpinner: false });
  NProgress.start();
});
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

interface PageProps {
  session: any;
  dehydratedState: any;
}

function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps<PageProps>) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <Hydrate state={pageProps.dehydratedState}>
          <Script
            async
            strategy='beforeInteractive'
            src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4274133898976040'
            crossOrigin='anonymous'
          />
          <DefaultSeo {...SEO} />
          {process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' ? (
            <Maintenance />
          ) : (
            <Layout>
              <Component {...pageProps} />
            </Layout>
          )}
          <Toaster position='bottom-center' />
        </Hydrate>
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default MyApp;
