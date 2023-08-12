/* eslint-disable no-param-reassign */
/** @type {import('next').NextConfig} */
const runtimeCaching = require('next-pwa/cache');
const withPWA = require('next-pwa')({
  dest: 'public',
  runtimeCaching,
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  transpilePackages: ['@umamin/db', '@umamin/generated'],
  modularizeImports: {
    'date-fns': {
      transform: 'date-fns/{{member}}',
      preventFullImport: true,
    },
  },
  images: {
    domains: ['cdn.discordapp.com', 'lh3.googleusercontent.com'],
  },
  webpack: (config) => {
    if (!config.experiments) {
      config.experiments = {};
    }
    config.experiments.topLevelAwait = true;
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };

    return config;
  },
  async redirects() {
    return [
      {
        source: '/discord',
        destination: 'https://discord.gg/bQKG7axhcF',
        permanent: true,
      },
    ];
  },
});
