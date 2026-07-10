import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tmp/shared", "@tmp/civic"],
};

export default nextConfig;
