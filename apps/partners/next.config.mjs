/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@umamin/ui",
    "@umamin/db",
    "@umamin/gql",
    "@umamin/shared",
  ],
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
