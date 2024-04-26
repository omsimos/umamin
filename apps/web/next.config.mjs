/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@umamin/ui", "@umamin/server"],
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
