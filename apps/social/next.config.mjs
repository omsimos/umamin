/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  transpilePackages: [
    "@umamin/ui",
    "@umamin/db",
    "@umamin/gql",
    "@umamin/shared",
  ],
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
