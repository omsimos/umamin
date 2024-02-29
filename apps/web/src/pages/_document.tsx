import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  return (
    <Html className='dark scroll-smooth'>
      <Head />
      <body className='dark:bg-secondary-300 text-secondary-300 bg-[#e2e2e2] dark:text-white'>
        <Main />
        <NextScript />
        <Script
          async
          strategy='beforeInteractive'
          src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4274133898976040'
          crossOrigin='anonymous'
        />
      </body>
    </Html>
  );
}
