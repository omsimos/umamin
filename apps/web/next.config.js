/* eslint-disable no-param-reassign */
/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa');

const nextConfig = {
  reactStrictMode: true,
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
};

module.exports = withPWA({
  pwa: {
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
  },
});

module.exports = nextConfig;
