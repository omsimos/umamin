import React from 'react';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClientProvider, Hydrate } from 'react-query';

import { queryClient } from '@/api';
import { Layout } from '@/components';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Hydrate state={pageProps.dehydratedState}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </Hydrate>
    </QueryClientProvider>
  );
}

export default MyApp;
