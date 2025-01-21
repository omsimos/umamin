import remarkGfm from "remark-gfm";
import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  serverExternalPackages: ["@node-rs/argon2", "@sentry/nextjs"],
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

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
  },
});

export default withMDX(nextConfig);
