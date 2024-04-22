/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@umamin/ui", "@umamin/db"],
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
