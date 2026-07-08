import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tmp/shared"],
};

export default nextConfig;
