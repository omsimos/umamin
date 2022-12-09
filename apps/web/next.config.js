/* eslint-disable no-param-reassign */
/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa');
const runtimeCaching = require('next-pwa/cache');

module.exports = withPWA({
  reactStrictMode: true,
  pwa: {
    dest: 'public',
    runtimeCaching,
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
  },
  images: {
    domains: ['cdn.discordapp.com', 'lh3.googleusercontent.com'],
  },
  webpack: (config) => {
    if (!config.experiments) {
      config.experiments = {};
    }
    config.experiments.topLevelAwait = true;
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
