/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@umamin/ui", "@umamin/db", "@umamin/gql"],
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
