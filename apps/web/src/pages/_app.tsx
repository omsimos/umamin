import React from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  HydrationBoundary,
} from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import toast, { Toaster } from 'react-hot-toast';
import { Inter, Syne } from 'next/font/google';
import { DefaultSeo } from 'next-seo';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import Router from 'next/router';

import type { AppProps } from 'next/app';
import type { Session } from 'next-auth';
import type { DehydratedState } from '@tanstack/react-query';

import { ErrorBoundary, Maintenance } from '@/components';

import '../styles/globals.css';
import SEO from '../../next-seo-config';
import type { NextPageWithLayout } from '..';

Router.events.on('routeChangeStart', () => {
  NProgress.configure({ showSpinner: false });
  NProgress.start();
});
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

type AppPropsWithLayout = AppProps<{
  session: Session;
  dehydratedState: DehydratedState;
}> & {
  Component: NextPageWithLayout<{ dehydratedState: DehydratedState }>;
};

const inter = Inter({ subsets: ['latin'] });
const syne = Syne({ subsets: ['latin'], variable: '--font-syne' });

function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page: React.ReactElement) => page);

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err: any) => {
            if (err.response?.errors?.length) {
              toast.error(err.response.errors[0].message);
            } else {
              toast.error(err.message);
            }
          },
        }),

        mutationCache: new MutationCache({
          onError: (err: any) => {
            if (err.response?.errors?.length) {
              toast.error(err.response.errors[0].message);
            } else {
              toast.error(err.message);
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={pageProps.dehydratedState}>
          <DefaultSeo {...SEO} />
          {process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' ? (
            <Maintenance />
          ) : (
            <ErrorBoundary>
              <style jsx global>{`
                html {
                  font-family: ${inter.style.fontFamily};
                }
              `}</style>
              <main className={syne.variable}>
                {getLayout(<Component {...pageProps} />)}
              </main>
            </ErrorBoundary>
          )}
          <Toaster
            position='bottom-center'
            containerClassName='md:mb-auto mb-24'
            toastOptions={{
              className: 'bg-secondary-200 text-secondary-100',
              style: {
                background: '#2D2E34',
                color: '#F5F5F5',
              },
            }}
          />
        </HydrationBoundary>
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default MyApp;
