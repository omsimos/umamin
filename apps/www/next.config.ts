import createMDX from "@next/mdx";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL("https://lh3.googleusercontent.com/a/**")],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  transpilePackages: ["@umamin/db", "@umamin/encryption", "@umamin/ui"],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
  },
});

export default withMDX(nextConfig);
